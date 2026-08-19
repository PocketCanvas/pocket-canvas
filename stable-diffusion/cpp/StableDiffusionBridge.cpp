#include <jni.h>
#include <cstdio>
#include <cstring>
#include <fstream>
#include <string>
#include <vector>
#include <chrono>
#include <ctime>
#include <android/log.h>
#include "stable-diffusion.cpp/include/stable-diffusion.h"

#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stable-diffusion.cpp/thirdparty/stb_image_write.h"

#define LOG_TAG "StableDiffusionBridge"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

struct PerfSnapshot {
    std::chrono::steady_clock::time_point wall;
    long long cpu_ms;
    long rss_kb;
};

static PerfSnapshot perf_snapshot() {
    timespec cpu{};
    clock_gettime(CLOCK_PROCESS_CPUTIME_ID, &cpu);

    long rss_kb = -1;
    std::ifstream status("/proc/self/status");
    std::string line;
    while (std::getline(status, line)) {
        if (std::sscanf(line.c_str(), "VmRSS: %ld kB", &rss_kb) == 1) break;
    }
    return {
        std::chrono::steady_clock::now(),
        static_cast<long long>(cpu.tv_sec) * 1000 + cpu.tv_nsec / 1000000,
        rss_kb,
    };
}

static void log_perf_span(const char* span, const PerfSnapshot& start) {
    const auto end = perf_snapshot();
    const auto wall_ms = std::chrono::duration_cast<std::chrono::milliseconds>(end.wall - start.wall).count();
    const auto cpu_ms = end.cpu_ms - start.cpu_ms;
    const double cpu_ratio = wall_ms > 0 ? 100.0 * cpu_ms / wall_ms : 0.0;
    LOGI("[perf] span=%s wall_ms=%lld cpu_ms=%lld cpu_ratio=%.1f rss_kb=%ld rss_delta_kb=%ld",
         span, static_cast<long long>(wall_ms), cpu_ms, cpu_ratio,
         end.rss_kb, start.rss_kb >= 0 && end.rss_kb >= 0 ? end.rss_kb - start.rss_kb : -1);
}

struct ProgressLogContext {
    std::chrono::steady_clock::time_point started_at;
    JNIEnv* env;
    jobject module;
    jmethodID emit_progress;
    int steps;
    enum class Stage { Loading, Encoding, Sampling, Decoding } stage = Stage::Loading;
    bool decoding_emitted = false;
    PerfSnapshot stage_started;
    PerfSnapshot step_started;
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
    const bool summary = std::strstr(text, "Initializing backend") != nullptr ||
                         std::strstr(text, "total params memory size") != nullptr ||
                         std::strstr(text, "compute buffer size") != nullptr ||
                         std::strstr(text, "loading tae from") != nullptr ||
                         std::strstr(text, "using TAE for") != nullptr ||
                         std::strstr(text, "using VAE for") != nullptr ||
                         std::strstr(text, "apply_loras completed") != nullptr ||
                         std::strstr(text, "sampling completed") != nullptr ||
                         std::strstr(text, "decode_first_stage completed") != nullptr ||
                         std::strstr(text, "generate_image completed") != nullptr;
    if (level >= SD_LOG_WARN || summary) {
        __android_log_print(priority, LOG_TAG, "[stable-diffusion.cpp] %s", text);
    }
    auto* context = static_cast<ProgressLogContext*>(data);
    if (context->stage == ProgressLogContext::Stage::Encoding &&
        std::strstr(text, "get_learned_condition completed") != nullptr) {
        log_perf_span("encoding", context->stage_started);
        context->stage = ProgressLogContext::Stage::Sampling;
        context->stage_started = perf_snapshot();
        context->step_started = context->stage_started;
        emit_progress(context, "sampling", 0, context->steps);
    } else if (!context->decoding_emitted && std::strstr(text, "decoding ") != nullptr) {
        log_perf_span("sampling", context->stage_started);
        context->stage = ProgressLogContext::Stage::Decoding;
        context->decoding_emitted = true;
        context->stage_started = perf_snapshot();
        emit_progress(context, "decoding");
    }
}

static void android_progress_callback(int step, int steps, float step_seconds, void* data) {
    auto* context = static_cast<ProgressLogContext*>(data);
    if (context->stage == ProgressLogContext::Stage::Loading) {
        emit_progress(context, "loading", step, steps);
    } else if (context->stage == ProgressLogContext::Stage::Sampling && steps == context->steps) {
        const auto total_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now() - context->started_at
        ).count();
        LOGI("[progress] step %d/%d completed in %.2fs (total=%lld ms)",
             step, steps, step_seconds, static_cast<long long>(total_ms));
        log_perf_span("sampling_step", context->step_started);
        context->step_started = perf_snapshot();
        emit_progress(context, "sampling", step, steps);
    }
}

static void log_available_devices() {
    const size_t required_size = sd_list_devices(nullptr, 0);
    std::vector<char> devices(required_size + 1, '\0');
    sd_list_devices(devices.data(), devices.size());
    LOGI("Available backend devices:\n%s", devices.data());
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
    jstring jModelPath,
    jstring jTaesdPath,
    jobjectArray jLoraPaths,
    jdoubleArray jLoraWeights,
    jint steps,
    jstring jOutputPath
) {
    const char *prompt = env->GetStringUTFChars(jPrompt, nullptr);
    const char *model_path = env->GetStringUTFChars(jModelPath, nullptr);
    const char *taesd_path = env->GetStringUTFChars(jTaesdPath, nullptr);
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

    // ── Diagnostic: elapsed time tracker ──
    auto t_start = std::chrono::steady_clock::now();
    auto elapsed_ms = [&t_start]() -> long long {
        return std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::steady_clock::now() - t_start
        ).count();
    };

    LOGI("========================================");
    LOGI("[%lld ms] generateImage() JNI entry", elapsed_ms());
    LOGI("[%lld ms] Model: %s", elapsed_ms(), model_path);
    LOGI("[%lld ms] TAESD: %s", elapsed_ms(), taesd_path[0] ? taesd_path : "disabled");
    LOGI("[%lld ms] LoRAs: %d", elapsed_ms(), static_cast<int>(lora_count));
    LOGI("[%lld ms] Prompt bytes: %zu", elapsed_ms(), std::strlen(prompt));
    LOGI("========================================");

    jclass module_class = env->GetObjectClass(thiz);
    jmethodID emit_progress_method = env->GetMethodID(
        module_class,
        "emitProgress",
        "(Ljava/lang/String;II)V"
    );
    const auto generation_started = perf_snapshot();
    ProgressLogContext progress_context{
        t_start, env, thiz, emit_progress_method, steps,
        ProgressLogContext::Stage::Loading, false, generation_started, generation_started
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

    LOGI("[%lld ms] Calling new_sd_ctx() — model loading starts...", elapsed_ms());
    sd_ctx_t* sd_ctx = new_sd_ctx(&ctx_params);
    LOGI("[%lld ms] new_sd_ctx() returned (ptr=%p)", elapsed_ms(), sd_ctx);
    log_perf_span("loading", progress_context.stage_started);

    if (!sd_ctx) {
        LOGE("[%lld ms] FAILED: sd_ctx is null — model load failed", elapsed_ms());
        sd_set_progress_callback(nullptr, nullptr);
        sd_set_log_callback(nullptr, nullptr);
        env->ReleaseStringUTFChars(jPrompt, prompt);
        env->ReleaseStringUTFChars(jModelPath, model_path);
        env->ReleaseStringUTFChars(jTaesdPath, taesd_path);
        env->ReleaseStringUTFChars(jOutputPath, output_path);
        env->ReleaseDoubleArrayElements(jLoraWeights, lora_weights, JNI_ABORT);
        env->DeleteLocalRef(module_class);
        log_perf_span("generation_total", generation_started);
        return env->NewStringUTF("Error: Failed to create SD context");
    }

    progress_context.stage = ProgressLogContext::Stage::Encoding;
    progress_context.stage_started = perf_snapshot();
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
    img_params.width = 512;
    img_params.height = 512;
    img_params.sample_params.sample_steps = steps;
    img_params.sample_params.sample_method = LCM_SAMPLE_METHOD;
    img_params.sample_params.scheduler = LCM_SCHEDULER;
    img_params.sample_params.guidance.txt_cfg = 1.0f;

    sd_image_t* results = nullptr;
    int num_images = 0;

    LOGI("[%lld ms] Calling generate_image() — inference starts (512x512, LCM, %d steps, CFG 1.0)...", elapsed_ms(), steps);
    bool success = generate_image(sd_ctx, &img_params, &results, &num_images);
    LOGI("[%lld ms] generate_image() returned (success=%d, num_images=%d)", elapsed_ms(), success, num_images);
    log_perf_span(
        progress_context.stage == ProgressLogContext::Stage::Decoding ? "decoding" :
        progress_context.stage == ProgressLogContext::Stage::Sampling ? "sampling" : "encoding",
        progress_context.stage_started
    );

    std::string result_path = "";
    if (success && num_images > 0 && results != nullptr) {
        const auto png_started = perf_snapshot();
        LOGI("[%lld ms] Saving PNG to %s (w=%d, h=%d, ch=%d)", elapsed_ms(), output_path, results[0].width, results[0].height, results[0].channel);
        int write_res = stbi_write_png(output_path, results[0].width, results[0].height, results[0].channel, results[0].data, results[0].width * results[0].channel);
        log_perf_span("png_write", png_started);
        if (write_res == 0) {
            LOGE("[%lld ms] FAILED: stbi_write_png returned 0", elapsed_ms());
            result_path = "Error: Failed to write image";
        } else {
            LOGI("[%lld ms] PNG saved successfully", elapsed_ms());
            result_path = std::string("file://") + output_path;
        }
        free_sd_images(results, num_images);
    } else {
        LOGE("[%lld ms] FAILED: generate_image returned success=%d, num_images=%d, results=%p", elapsed_ms(), success, num_images, results);
        result_path = "Error: Image generation failed";
    }

    LOGI("[%lld ms] Freeing sd_ctx...", elapsed_ms());
    const auto free_started = perf_snapshot();
    free_sd_ctx(sd_ctx);
    log_perf_span("context_free", free_started);
    LOGI("[%lld ms] sd_ctx freed", elapsed_ms());

    env->ReleaseStringUTFChars(jPrompt, prompt);
    env->ReleaseStringUTFChars(jModelPath, model_path);
    env->ReleaseStringUTFChars(jTaesdPath, taesd_path);
    env->ReleaseStringUTFChars(jOutputPath, output_path);
    env->ReleaseDoubleArrayElements(jLoraWeights, lora_weights, JNI_ABORT);
    env->DeleteLocalRef(module_class);

    LOGI("========================================");
    LOGI("[%lld ms] generateImage() TOTAL completed", elapsed_ms());
    log_perf_span("generation_total", generation_started);
    LOGI("========================================");

    sd_set_progress_callback(nullptr, nullptr);
    sd_set_log_callback(nullptr, nullptr);

    return env->NewStringUTF(result_path.c_str());
}
