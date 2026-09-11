#include <jni.h>
#include <cstring>
#include <mutex>
#include <string>
#include <vector>
#include <android/log.h>

#include "GenerationDiagnostics.h"
#include "GenerationOptions.h"
#include "MemoryPolicy.h"
#include "NativeCallbacks.h"
#include "stable-diffusion.cpp/include/stable-diffusion.h"

#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stable-diffusion.cpp/thirdparty/stb_image_write.h"

#define LOG_TAG "StableDiffusionBridge"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

using namespace pocket_canvas;

static std::mutex operation_mutex;

extern "C"
JNIEXPORT jstring JNICALL
Java_expo_modules_stablediffusion_StableDiffusionModule_getSystemInfo(JNIEnv *env, jobject thiz) {
    return env->NewStringUTF(sd_get_system_info());
}

extern "C"
JNIEXPORT jstring JNICALL
Java_expo_modules_stablediffusion_StableDiffusionModule_quantizeModel(
    JNIEnv* env,
    jobject thiz,
    jstring jInputPath,
    jstring jOutputPath,
    jstring jType
) {
    std::unique_lock<std::mutex> operation_lock(operation_mutex, std::try_to_lock);
    if (!operation_lock.owns_lock()) {
        return env->NewStringUTF("Error: Another native model operation is already running");
    }
    ScopedCallbacksReset callbacks_reset;

    const char* input_path = env->GetStringUTFChars(jInputPath, nullptr);
    const char* output_path = env->GetStringUTFChars(jOutputPath, nullptr);
    const char* type_name = env->GetStringUTFChars(jType, nullptr);
    const sd_type_t type = str_to_sd_type(type_name);

    if (!is_supported_quantization_type(type)) {
        env->ReleaseStringUTFChars(jInputPath, input_path);
        env->ReleaseStringUTFChars(jOutputPath, output_path);
        env->ReleaseStringUTFChars(jType, type_name);
        return env->NewStringUTF("Error: Unsupported quantization type");
    }

    const auto started = Clock::now();
    LOGI("[quantize] start type=%s", type_name);
    JavaVM* java_vm = nullptr;
    env->GetJavaVM(&java_vm);
    jclass module_class = env->GetObjectClass(thiz);
    jmethodID emit_progress_method = env->GetMethodID(
        module_class,
        "emitQuantizationProgress",
        "(II)V"
    );
    jobject module_global_ref = env->NewGlobalRef(thiz);
    QuantizationProgressContext progress_context{
        java_vm, module_global_ref, emit_progress_method
    };
    sd_set_log_callback(android_quantization_log_callback, nullptr);
    sd_set_progress_callback(android_quantization_progress_callback, &progress_context);
    const bool success = convert(input_path, nullptr, output_path, type, "", false);
    LOGI("[quantize] success=%s elapsed=%.2fs", success ? "true" : "false", elapsed_seconds(started));

    env->DeleteGlobalRef(module_global_ref);
    env->DeleteLocalRef(module_class);

    jstring result = env->NewStringUTF(success ? output_path : "Error: Model quantization failed");
    env->ReleaseStringUTFChars(jInputPath, input_path);
    env->ReleaseStringUTFChars(jOutputPath, output_path);
    env->ReleaseStringUTFChars(jType, type_name);
    return result;
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
    jstring jModelFamily,
    jstring jModelFamilyEvidence,
    jstring jModelVariant,
    jstring jModelVariantEvidence,
    jstring jDiffusionStorage,
    jdouble diffusionBytes,
    jstring jVaeArchitecture,
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
    jstring jOutputPath,
    jstring jDiagnosticPath,
    jstring jInferenceBackend
) {
    std::unique_lock<std::mutex> operation_lock(operation_mutex, std::try_to_lock);
    if (!operation_lock.owns_lock()) {
        return env->NewStringUTF("Error: Another native model operation is already running");
    }
    ScopedCallbacksReset callbacks_reset;

    const char *prompt = env->GetStringUTFChars(jPrompt, nullptr);
    const char *negative_prompt = env->GetStringUTFChars(jNegativePrompt, nullptr);
    const char *model_path = env->GetStringUTFChars(jModelPath, nullptr);
    const char *taesd_path = env->GetStringUTFChars(jTaesdPath, nullptr);
    const char *model_family = env->GetStringUTFChars(jModelFamily, nullptr);
    const char *model_family_evidence = env->GetStringUTFChars(jModelFamilyEvidence, nullptr);
    const char *model_variant = env->GetStringUTFChars(jModelVariant, nullptr);
    const char *model_variant_evidence = env->GetStringUTFChars(jModelVariantEvidence, nullptr);
    const char *diffusion_storage = env->GetStringUTFChars(jDiffusionStorage, nullptr);
    const char *vae_architecture = env->GetStringUTFChars(jVaeArchitecture, nullptr);
    const char *sampling_preset = env->GetStringUTFChars(jSamplingPreset, nullptr);
    const char *upscaler_type = env->GetStringUTFChars(jUpscalerType, nullptr);
    const char *output_path = env->GetStringUTFChars(jOutputPath, nullptr);
    const char *diagnostic_path = env->GetStringUTFChars(jDiagnosticPath, nullptr);
    const char *inference_backend = env->GetStringUTFChars(jInferenceBackend, nullptr);
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
        env->ReleaseStringUTFChars(jModelFamily, model_family);
        env->ReleaseStringUTFChars(jModelFamilyEvidence, model_family_evidence);
        env->ReleaseStringUTFChars(jModelVariant, model_variant);
        env->ReleaseStringUTFChars(jModelVariantEvidence, model_variant_evidence);
        env->ReleaseStringUTFChars(jDiffusionStorage, diffusion_storage);
        env->ReleaseStringUTFChars(jVaeArchitecture, vae_architecture);
        env->ReleaseStringUTFChars(jSamplingPreset, sampling_preset);
        env->ReleaseStringUTFChars(jUpscalerType, upscaler_type);
        env->ReleaseStringUTFChars(jOutputPath, output_path);
        env->ReleaseStringUTFChars(jDiagnosticPath, diagnostic_path);
        env->ReleaseStringUTFChars(jInferenceBackend, inference_backend);
        env->ReleaseDoubleArrayElements(jLoraWeights, lora_weights, JNI_ABORT);
        return env->NewStringUTF("Error: Unsupported generation option");
    }

    // ?? Diagnostic: elapsed time tracker ??
    const auto generation_started = Clock::now();
    LOGI("[request] start taesd=%s loras=%d",
         taesd_path[0] ? "enabled" : "disabled", static_cast<int>(lora_count));
    LOGI("[settings] size=%dx%d preset=%s scheduler=%s steps=%d cfg=%.2f",
         width, height, sampling_preset, sd_scheduler_name(scheduler), steps, cfgScale);
    const ModelMemoryDescriptor model_descriptor{
        model_family, model_family_evidence, model_variant, model_variant_evidence,
        diffusion_storage, diffusionBytes, vae_architecture
    };
    const MemoryWorkload memory_workload{
        width, height, lora_count > 0, taesd_path[0] != '\0',
        upscaler != SD_HIRES_UPSCALER_NONE
    };
    const ResolvedMemoryPolicy memory_policy =
        resolve_memory_policy(model_descriptor, memory_workload);
    const bool force_cpu_backend = std::strcmp(inference_backend, "cpu") == 0;
    const char* applied_compute_backend = force_cpu_backend ? "cpu" : "vulkan";
    const char* applied_params_backend = force_cpu_backend ? "*=cpu" : memory_policy.params_backend;
    const char* vae_tiling = memory_policy.vae_tiling ? "48x48@0.50" : "disabled";
    LOGI("[model] family=%s family_evidence=%s diffusion_storage=%s diffusion_bytes=%.0f vae=%s",
         model_family, model_family_evidence, diffusion_storage, diffusionBytes, vae_architecture);
    LOGI("[settings] hires=%s scale=%.1f steps=%d denoise=%.2f memory_source=%s memory_policy=%s",
         upscaler_type, upscaleFactor, hiresSteps, hiresDenoisingStrength,
         memory_policy.source, memory_policy.id);
    LOGI("[settings] backend=%s diffusion_fa=%s params_backend=%s max_vram=disabled stream_layers=disabled vae_tiling=%s",
         applied_compute_backend,
         memory_policy.diffusion_flash_attn ? "enabled" : "disabled",
         applied_params_backend ? applied_params_backend : "default", vae_tiling);

    DiagnosticRecord diagnostic;
    diagnostic.path = diagnostic_path ? diagnostic_path : "";
    diagnostic.family = model_family;
    diagnostic.family_evidence = model_family_evidence;
    diagnostic.diffusion_storage = diffusion_storage;
    diagnostic.diffusion_bytes = diffusionBytes;
    diagnostic.preset = sampling_preset;
    diagnostic.memory_source = memory_policy.source;
    diagnostic.memory_policy = memory_policy.id;
    diagnostic.params_backend = applied_params_backend ? applied_params_backend : "default";
    diagnostic.compute_backend = applied_compute_backend;
    diagnostic.params_compute =
        applied_params_backend && std::strstr(applied_params_backend, "cpu")
            ? "cpu"
            : applied_compute_backend;
    diagnostic.vae_tiling = vae_tiling;
    diagnostic.diffusion_fa = memory_policy.diffusion_flash_attn;
    diagnostic.taesd = taesd_path[0] != '\0';
    diagnostic.hires = upscaler != SD_HIRES_UPSCALER_NONE;
    diagnostic.width = width;
    diagnostic.height = height;
    diagnostic.steps = steps;
    diagnostic.lora_count = static_cast<int>(lora_count);
    diagnostic.cfg = cfgScale;
    write_generation_diagnostic(diagnostic, "loading", true);
    query_vulkan_identity(diagnostic.vulkan_device, diagnostic.vulkan_api, diagnostic.vulkan_driver);
    write_generation_diagnostic(diagnostic, "loading", true);

    jclass module_class = env->GetObjectClass(thiz);
    jmethodID emit_progress_method = env->GetMethodID(
        module_class,
        "emitProgress",
        "(Ljava/lang/String;II)V"
    );
    ProgressLogContext progress_context{
        env, thiz, emit_progress_method, steps,
        ProgressLogContext::Stage::Loading, false, generation_started, &diagnostic
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
    ctx_params.backend = applied_compute_backend;
    ctx_params.diffusion_flash_attn = memory_policy.diffusion_flash_attn;
    ctx_params.params_backend = applied_params_backend;
    ctx_params.lora_apply_mode = LORA_APPLY_AT_RUNTIME;

    sd_ctx_t* sd_ctx = new_sd_ctx(&ctx_params);
    LOGI("[stage] loading %.2fs", elapsed_seconds(progress_context.stage_started));

    if (!sd_ctx) {
        LOGE("[request] failed: model load");
        clear_generation_diagnostic(diagnostic.path);
        sd_set_progress_callback(nullptr, nullptr);
        sd_set_log_callback(nullptr, nullptr);
        env->ReleaseStringUTFChars(jPrompt, prompt);
        env->ReleaseStringUTFChars(jNegativePrompt, negative_prompt);
        env->ReleaseStringUTFChars(jModelPath, model_path);
        env->ReleaseStringUTFChars(jTaesdPath, taesd_path);
        env->ReleaseStringUTFChars(jModelFamily, model_family);
        env->ReleaseStringUTFChars(jModelFamilyEvidence, model_family_evidence);
        env->ReleaseStringUTFChars(jModelVariant, model_variant);
        env->ReleaseStringUTFChars(jModelVariantEvidence, model_variant_evidence);
        env->ReleaseStringUTFChars(jDiffusionStorage, diffusion_storage);
        env->ReleaseStringUTFChars(jVaeArchitecture, vae_architecture);
        env->ReleaseStringUTFChars(jSamplingPreset, sampling_preset);
        env->ReleaseStringUTFChars(jUpscalerType, upscaler_type);
        env->ReleaseStringUTFChars(jOutputPath, output_path);
        env->ReleaseStringUTFChars(jDiagnosticPath, diagnostic_path);
        env->ReleaseStringUTFChars(jInferenceBackend, inference_backend);
        env->ReleaseDoubleArrayElements(jLoraWeights, lora_weights, JNI_ABORT);
        env->DeleteLocalRef(module_class);
        return env->NewStringUTF("Error: Failed to create SD context");
    }

    progress_context.stage = ProgressLogContext::Stage::Encoding;
    progress_context.stage_started = Clock::now();
    if (diagnostic.lora_count > 0) {
        write_generation_diagnostic(diagnostic, "lora_apply", true);
    } else {
        write_generation_diagnostic(diagnostic, "text_encoding_prepare", true);
        write_generation_diagnostic(diagnostic, "text_encoding_params", true);
    }
    emit_progress(&progress_context, "encoding");

    sd_img_gen_params_t img_params;
    sd_img_gen_params_init(&img_params);
    if (memory_policy.vae_tiling) {
        img_params.vae_tiling_params.enabled = true;
        img_params.vae_tiling_params.tile_size_x = memory_policy.vae_tile_x;
        img_params.vae_tiling_params.tile_size_y = memory_policy.vae_tile_y;
        img_params.vae_tiling_params.target_overlap = memory_policy.vae_overlap;
    }
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
    clear_generation_diagnostic(diagnostic.path);
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
    env->ReleaseStringUTFChars(jModelFamily, model_family);
    env->ReleaseStringUTFChars(jModelFamilyEvidence, model_family_evidence);
    env->ReleaseStringUTFChars(jModelVariant, model_variant);
    env->ReleaseStringUTFChars(jModelVariantEvidence, model_variant_evidence);
    env->ReleaseStringUTFChars(jDiffusionStorage, diffusion_storage);
    env->ReleaseStringUTFChars(jVaeArchitecture, vae_architecture);
    env->ReleaseStringUTFChars(jSamplingPreset, sampling_preset);
    env->ReleaseStringUTFChars(jUpscalerType, upscaler_type);
    env->ReleaseStringUTFChars(jOutputPath, output_path);
    env->ReleaseStringUTFChars(jDiagnosticPath, diagnostic_path);
    env->ReleaseStringUTFChars(jInferenceBackend, inference_backend);
    env->ReleaseDoubleArrayElements(jLoraWeights, lora_weights, JNI_ABORT);
    env->DeleteLocalRef(module_class);

    LOGI("[request] complete success=%d total=%.2fs", result_path.rfind("file://", 0) == 0,
         elapsed_seconds(generation_started));

    sd_set_progress_callback(nullptr, nullptr);
    sd_set_log_callback(nullptr, nullptr);

    return env->NewStringUTF(result_path.c_str());
}
