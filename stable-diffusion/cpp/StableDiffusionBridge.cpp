#include <jni.h>
#include <cstring>
#include <string>
#include <vector>
#include <chrono>
#include <algorithm>
#include <android/log.h>
#include "stable-diffusion.cpp/include/stable-diffusion.h"

#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stable-diffusion.cpp/thirdparty/stb_image_write.h"

#define LOG_TAG "StableDiffusionBridge"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

using Clock = std::chrono::steady_clock;

static double elapsed_seconds(const Clock::time_point& start) {
    return std::chrono::duration<double>(Clock::now() - start).count();
}

struct ProgressLogContext {
    JNIEnv* env;
    jobject module;
    jmethodID emit_progress;
    int steps;
    enum class Stage { Loading, Encoding, Sampling, Decoding } stage = Stage::Loading;
    bool decoding_emitted = false;
    Clock::time_point stage_started;
};

static void emit_progress(ProgressLogContext* context, const char* stage, int step = 0, int steps = 0) {
    jstring j_stage = context->env->NewStringUTF(stage);
    context->env->CallVoidMethod(context->module, context->emit_progress, j_stage, step, steps);
    context->env->DeleteLocalRef(j_stage);
    if (context->env->ExceptionCheck()) {
        LOGE("Failed to emit progress event");
        context->env->ExceptionClear();
    }
}

static void android_sd_log_callback(sd_log_level_t level, const char* text, void* data) {
    const int priority = level == SD_LOG_ERROR ? ANDROID_LOG_ERROR
                       : level == SD_LOG_WARN  ? ANDROID_LOG_WARN
                                               : ANDROID_LOG_INFO;
    if (level >= SD_LOG_WARN) {
        __android_log_print(priority, LOG_TAG, "[stable-diffusion.cpp] %s", text);
    }
    auto* context = static_cast<ProgressLogContext*>(data);
    if (context->stage == ProgressLogContext::Stage::Encoding &&
        std::strstr(text, "get_learned_condition completed") != nullptr) {
        LOGI("[stage] encoding %.2fs", elapsed_seconds(context->stage_started));
        context->stage = ProgressLogContext::Stage::Sampling;
        context->stage_started = Clock::now();
        emit_progress(context, "sampling", 0, context->steps);
    } else if (!context->decoding_emitted && std::strstr(text, "decoding ") != nullptr) {
        LOGI("[stage] sampling %.2fs", elapsed_seconds(context->stage_started));
        context->stage = ProgressLogContext::Stage::Decoding;
        context->decoding_emitted = true;
        context->stage_started = Clock::now();
        emit_progress(context, "decoding");
    }
}

static void android_progress_callback(int step, int steps, float, void* data) {
    auto* context = static_cast<ProgressLogContext*>(data);
    if (context->stage == ProgressLogContext::Stage::Loading) {
        emit_progress(context, "loading", step, steps);
    } else if (context->stage == ProgressLogContext::Stage::Sampling && steps == context->steps) {
        emit_progress(context, "sampling", step, steps);
    }
}

static void log_available_devices() {
    const size_t required_size = sd_list_devices(nullptr, 0);
    std::vector<char> devices(required_size + 1, '\0');
    sd_list_devices(devices.data(), devices.size());
    std::replace(devices.begin(), devices.end(), '\n', ' ');
    LOGI("[vulkan] devices=%s", devices.data());
}

static bool resolve_sampling_preset(const char* preset, sample_method_t& method, scheduler_t& scheduler) {
    const char* method_name = preset;
    scheduler = DISCRETE_SCHEDULER;
    if (std::strcmp(preset, "dpmpp_2s_a") == 0) method_name = "dpm++2s_a";
    else if (std::strcmp(preset, "dpmpp_2m") == 0) method_name = "dpm++2m";
    else if (std::strcmp(preset, "dpmpp_2m_karras") == 0) {
        method_name = "dpm++2m";
        scheduler = KARRAS_SCHEDULER;
    } else if (std::strcmp(preset, "dpmpp_2m_v2") == 0) method_name = "dpm++2mv2";
    else if (std::strcmp(preset, "dpmpp_2m_sde") == 0) method_name = "dpm++2m_sde";
    else if (std::strcmp(preset, "dpmpp_2m_sde_karras") == 0) {
        method_name = "dpm++2m_sde";
        scheduler = KARRAS_SCHEDULER;
    } else if (std::strcmp(preset, "dpmpp_2m_sde_bt") == 0) method_name = "dpm++2m_sde_bt";
    else if (std::strcmp(preset, "ddim") == 0) {
        method_name = "ddim_trailing";
        scheduler = SIMPLE_SCHEDULER;
    } else if (std::strcmp(preset, "lcm") == 0 || std::strcmp(preset, "tcd") == 0) {
        scheduler = LCM_SCHEDULER;
    }
    method = str_to_sample_method(method_name);
    return method != SAMPLE_METHOD_COUNT;
}

static sd_hires_upscaler_t resolve_builtin_upscaler(const char* type) {
    if (std::strcmp(type, "none") == 0) return SD_HIRES_UPSCALER_NONE;
    if (std::strcmp(type, "latent") == 0) return SD_HIRES_UPSCALER_LATENT;
    if (std::strcmp(type, "latent_nearest") == 0) return SD_HIRES_UPSCALER_LATENT_NEAREST;
    if (std::strcmp(type, "latent_nearest_exact") == 0) return SD_HIRES_UPSCALER_LATENT_NEAREST_EXACT;
    if (std::strcmp(type, "latent_antialiased") == 0) return SD_HIRES_UPSCALER_LATENT_ANTIALIASED;
    if (std::strcmp(type, "latent_bicubic") == 0) return SD_HIRES_UPSCALER_LATENT_BICUBIC;
    if (std::strcmp(type, "latent_bicubic_antialiased") == 0) return SD_HIRES_UPSCALER_LATENT_BICUBIC_ANTIALIASED;
    if (std::strcmp(type, "lanczos") == 0) return SD_HIRES_UPSCALER_LANCZOS;
    if (std::strcmp(type, "nearest") == 0) return SD_HIRES_UPSCALER_NEAREST;
    return SD_HIRES_UPSCALER_COUNT;
}

extern "C"
JNIEXPORT jstring JNICALL
Java_expo_modules_stablediffusion_StableDiffusionModule_getSystemInfo(JNIEnv *env, jobject thiz) {
    return env->NewStringUTF(sd_get_system_info());
}

extern "C"
JNIEXPORT jstring JNICALL
Java_expo_modules_stablediffusion_StableDiffusionModule_generateImage(
    JNIEnv *env,
    jobject thiz,
    jstring jPrompt,
    jstring jNegativePrompt,
    jstring jModelPath,
    jstring jTaesdPath,
    jobjectArray jLoraPaths,
    jdoubleArray jLoraWeights,
    jint width,
    jint height,
    jstring jSamplingPreset,
    jint steps,
    jdouble cfgScale,
    jlong seed,
    jstring jUpscalerType,
    jdouble upscaleFactor,
    jint hiresSteps,
    jdouble hiresDenoisingStrength,
    jstring jOutputPath
) {
    const char *prompt = env->GetStringUTFChars(jPrompt, nullptr);
    const char *negative_prompt = env->GetStringUTFChars(jNegativePrompt, nullptr);
    const char *model_path = env->GetStringUTFChars(jModelPath, nullptr);
    const char *taesd_path = env->GetStringUTFChars(jTaesdPath, nullptr);
    const char *sampling_preset = env->GetStringUTFChars(jSamplingPreset, nullptr);
    const char *upscaler_type = env->GetStringUTFChars(jUpscalerType, nullptr);
    const char *output_path = env->GetStringUTFChars(jOutputPath, nullptr);
    const jsize lora_count = env->GetArrayLength(jLoraPaths);
    std::vector<std::string> lora_paths;
    lora_paths.reserve(lora_count);
    for (jsize i = 0; i < lora_count; ++i) {
        auto j_path = static_cast<jstring>(env->GetObjectArrayElement(jLoraPaths, i));
        const char* path = env->GetStringUTFChars(j_path, nullptr);
        lora_paths.emplace_back(path);
        env->ReleaseStringUTFChars(j_path, path);
        env->DeleteLocalRef(j_path);
    }
    jdouble* lora_weights = env->GetDoubleArrayElements(jLoraWeights, nullptr);

    sample_method_t sample_method;
    scheduler_t scheduler;
    const auto upscaler = resolve_builtin_upscaler(upscaler_type);
    if (!resolve_sampling_preset(sampling_preset, sample_method, scheduler) ||
        upscaler == SD_HIRES_UPSCALER_COUNT) {
        env->ReleaseStringUTFChars(jPrompt, prompt);
        env->ReleaseStringUTFChars(jNegativePrompt, negative_prompt);
        env->ReleaseStringUTFChars(jModelPath, model_path);
        env->ReleaseStringUTFChars(jTaesdPath, taesd_path);
        env->ReleaseStringUTFChars(jSamplingPreset, sampling_preset);
        env->ReleaseStringUTFChars(jUpscalerType, upscaler_type);
        env->ReleaseStringUTFChars(jOutputPath, output_path);
        env->ReleaseDoubleArrayElements(jLoraWeights, lora_weights, JNI_ABORT);
        return env->NewStringUTF("Error: Unsupported generation option");
    }

    // ── Diagnostic: elapsed time tracker ──
    const auto generation_started = Clock::now();
    LOGI("[request] model=%s taesd=%s loras=%d", model_path,
         taesd_path[0] ? taesd_path : "disabled", static_cast<int>(lora_count));
    LOGI("[settings] prompt_bytes=%zu negative_bytes=%zu size=%dx%d preset=%s scheduler=%s steps=%d cfg=%.2f seed=%lld",
         std::strlen(prompt), std::strlen(negative_prompt), width, height, sampling_preset,
         sd_scheduler_name(scheduler), steps, cfgScale, static_cast<long long>(seed));
    LOGI("[settings] hires=%s scale=%.1f steps=%d denoise=%.2f output=%s",
         upscaler_type, upscaleFactor, hiresSteps, hiresDenoisingStrength, output_path);

    jclass module_class = env->GetObjectClass(thiz);
    jmethodID emit_progress_method = env->GetMethodID(
        module_class,
        "emitProgress",
        "(Ljava/lang/String;II)V"
    );
    ProgressLogContext progress_context{
        env, thiz, emit_progress_method, steps,
        ProgressLogContext::Stage::Loading, false, generation_started
    };
    sd_set_log_callback(android_sd_log_callback, &progress_context);
    sd_set_progress_callback(android_progress_callback, &progress_context);
    emit_progress(&progress_context, "loading");
    log_available_devices();

    sd_ctx_params_t ctx_params;
    sd_ctx_params_init(&ctx_params);
    ctx_params.model_path = model_path;
    ctx_params.taesd_path = taesd_path;
    ctx_params.enable_mmap = true;
    ctx_params.backend = "vulkan";
    ctx_params.lora_apply_mode = LORA_APPLY_AT_RUNTIME;

    sd_ctx_t* sd_ctx = new_sd_ctx(&ctx_params);
    LOGI("[stage] loading %.2fs", elapsed_seconds(progress_context.stage_started));

    if (!sd_ctx) {
        LOGE("[request] failed: model load");
        sd_set_progress_callback(nullptr, nullptr);
        sd_set_log_callback(nullptr, nullptr);
        env->ReleaseStringUTFChars(jPrompt, prompt);
        env->ReleaseStringUTFChars(jNegativePrompt, negative_prompt);
        env->ReleaseStringUTFChars(jModelPath, model_path);
        env->ReleaseStringUTFChars(jTaesdPath, taesd_path);
        env->ReleaseStringUTFChars(jSamplingPreset, sampling_preset);
        env->ReleaseStringUTFChars(jUpscalerType, upscaler_type);
        env->ReleaseStringUTFChars(jOutputPath, output_path);
        env->ReleaseDoubleArrayElements(jLoraWeights, lora_weights, JNI_ABORT);
        env->DeleteLocalRef(module_class);
        return env->NewStringUTF("Error: Failed to create SD context");
    }

    progress_context.stage = ProgressLogContext::Stage::Encoding;
    progress_context.stage_started = Clock::now();
    emit_progress(&progress_context, "encoding");

    sd_img_gen_params_t img_params;
    sd_img_gen_params_init(&img_params);
    std::vector<sd_lora_t> loras;
    loras.reserve(lora_count);
    for (jsize i = 0; i < lora_count; ++i) {
        loras.push_back({false, static_cast<float>(lora_weights[i]), lora_paths[i].c_str()});
    }
    img_params.loras = loras.empty() ? nullptr : loras.data();
    img_params.lora_count = static_cast<int>(loras.size());
    img_params.prompt = prompt;
    img_params.negative_prompt = negative_prompt;
    img_params.width = width;
    img_params.height = height;
    img_params.sample_params.sample_steps = steps;
    img_params.sample_params.sample_method = sample_method;
    img_params.sample_params.scheduler = scheduler;
    img_params.sample_params.guidance.txt_cfg = static_cast<float>(cfgScale);
    img_params.seed = seed;
    img_params.hires.enabled = upscaler != SD_HIRES_UPSCALER_NONE;
    img_params.hires.upscaler = upscaler;
    img_params.hires.scale = static_cast<float>(upscaleFactor);
    img_params.hires.steps = hiresSteps;
    img_params.hires.denoising_strength = static_cast<float>(hiresDenoisingStrength);

    sd_image_t* results = nullptr;
    int num_images = 0;

    bool success = generate_image(sd_ctx, &img_params, &results, &num_images);
    const char* final_stage = progress_context.stage == ProgressLogContext::Stage::Decoding ? "decoding" :
                              progress_context.stage == ProgressLogContext::Stage::Sampling ? "sampling" : "encoding";
    LOGI("[stage] %s %.2fs", final_stage, elapsed_seconds(progress_context.stage_started));

    std::string result_path = "";
    if (success && num_images > 0 && results != nullptr) {
        const auto png_started = Clock::now();
        int write_res = stbi_write_png(output_path, results[0].width, results[0].height, results[0].channel, results[0].data, results[0].width * results[0].channel);
        LOGI("[stage] png_write %.2fs (%dx%dx%d)", elapsed_seconds(png_started),
             results[0].width, results[0].height, results[0].channel);
        if (write_res == 0) {
            LOGE("[request] failed: PNG write");
            result_path = "Error: Failed to write image";
        } else {
            result_path = std::string("file://") + output_path;
        }
        free_sd_images(results, num_images);
    } else {
        LOGE("[request] failed: generation success=%d images=%d", success, num_images);
        result_path = "Error: Image generation failed";
    }

    free_sd_ctx(sd_ctx);

    env->ReleaseStringUTFChars(jPrompt, prompt);
    env->ReleaseStringUTFChars(jNegativePrompt, negative_prompt);
    env->ReleaseStringUTFChars(jModelPath, model_path);
    env->ReleaseStringUTFChars(jTaesdPath, taesd_path);
    env->ReleaseStringUTFChars(jSamplingPreset, sampling_preset);
    env->ReleaseStringUTFChars(jUpscalerType, upscaler_type);
    env->ReleaseStringUTFChars(jOutputPath, output_path);
    env->ReleaseDoubleArrayElements(jLoraWeights, lora_weights, JNI_ABORT);
    env->DeleteLocalRef(module_class);

    LOGI("[request] complete success=%d total=%.2fs", result_path.rfind("file://", 0) == 0,
         elapsed_seconds(generation_started));

    sd_set_progress_callback(nullptr, nullptr);
    sd_set_log_callback(nullptr, nullptr);

    return env->NewStringUTF(result_path.c_str());
}
