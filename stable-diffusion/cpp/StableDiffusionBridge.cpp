#include <jni.h>
#include <string>
#include <vector>
#include <chrono>
#include <android/log.h>
#include "stable-diffusion.cpp/include/stable-diffusion.h"

#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stable-diffusion.cpp/thirdparty/stb_image_write.h"

#define LOG_TAG "StableDiffusionBridge"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

static void android_sd_log_callback(sd_log_level_t level, const char* text, void*) {
    const int priority = level == SD_LOG_ERROR ? ANDROID_LOG_ERROR
                       : level == SD_LOG_WARN  ? ANDROID_LOG_WARN
                                               : ANDROID_LOG_INFO;
    __android_log_print(priority, LOG_TAG, "[stable-diffusion.cpp] %s", text);
}

struct ProgressLogContext {
    std::chrono::steady_clock::time_point started_at;
};

static void android_progress_callback(int step, int steps, float step_seconds, void* data) {
    const auto* context = static_cast<ProgressLogContext*>(data);
    const auto total_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::steady_clock::now() - context->started_at
    ).count();
    LOGI("[progress] step %d/%d completed in %.2fs (total=%lld ms)",
         step, steps, step_seconds, static_cast<long long>(total_ms));
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
Java_expo_modules_stablediffusion_StableDiffusionModule_generateImage(JNIEnv *env, jobject thiz, jstring jPrompt, jstring jModelPath, jstring jLoraPath, jstring jOutputPath) {
    const char *prompt = env->GetStringUTFChars(jPrompt, nullptr);
    const char *model_path = env->GetStringUTFChars(jModelPath, nullptr);
    const char *lora_path = env->GetStringUTFChars(jLoraPath, nullptr);
    const char *output_path = env->GetStringUTFChars(jOutputPath, nullptr);

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
    LOGI("[%lld ms] LCM-LoRA: %s", elapsed_ms(), lora_path);
    LOGI("[%lld ms] Prompt: %s", elapsed_ms(), prompt);
    LOGI("========================================");

    sd_set_log_callback(android_sd_log_callback, nullptr);
    ProgressLogContext progress_context{t_start};
    sd_set_progress_callback(android_progress_callback, &progress_context);
    log_available_devices();

    sd_ctx_params_t ctx_params;
    sd_ctx_params_init(&ctx_params);
    ctx_params.model_path = model_path;
    ctx_params.enable_mmap = true;
    ctx_params.backend = "vulkan";
    ctx_params.lora_apply_mode = LORA_APPLY_AT_RUNTIME;

    LOGI("[%lld ms] Calling new_sd_ctx() — model loading starts...", elapsed_ms());
    sd_ctx_t* sd_ctx = new_sd_ctx(&ctx_params);
    LOGI("[%lld ms] new_sd_ctx() returned (ptr=%p)", elapsed_ms(), sd_ctx);

    if (!sd_ctx) {
        LOGE("[%lld ms] FAILED: sd_ctx is null — model load failed", elapsed_ms());
        sd_set_progress_callback(nullptr, nullptr);
        sd_set_log_callback(nullptr, nullptr);
        env->ReleaseStringUTFChars(jPrompt, prompt);
        env->ReleaseStringUTFChars(jModelPath, model_path);
        env->ReleaseStringUTFChars(jLoraPath, lora_path);
        env->ReleaseStringUTFChars(jOutputPath, output_path);
        return env->NewStringUTF("Error: Failed to create SD context");
    }

    sd_img_gen_params_t img_params;
    sd_img_gen_params_init(&img_params);
    const sd_lora_t lcm_lora{false, 1.0f, lora_path};
    img_params.loras = &lcm_lora;
    img_params.lora_count = 1;
    img_params.prompt = prompt;
    img_params.width = 512;
    img_params.height = 512;
    img_params.sample_params.sample_steps = 4;
    img_params.sample_params.sample_method = LCM_SAMPLE_METHOD;
    img_params.sample_params.scheduler = LCM_SCHEDULER;
    img_params.sample_params.guidance.txt_cfg = 1.0f;

    sd_image_t* results = nullptr;
    int num_images = 0;

    LOGI("[%lld ms] Calling generate_image() — inference starts (512x512, LCM, 4 steps, CFG 1.0)...", elapsed_ms());
    bool success = generate_image(sd_ctx, &img_params, &results, &num_images);
    LOGI("[%lld ms] generate_image() returned (success=%d, num_images=%d)", elapsed_ms(), success, num_images);

    std::string result_path = "";
    if (success && num_images > 0 && results != nullptr) {
        LOGI("[%lld ms] Saving PNG to %s (w=%d, h=%d, ch=%d)", elapsed_ms(), output_path, results[0].width, results[0].height, results[0].channel);
        int write_res = stbi_write_png(output_path, results[0].width, results[0].height, results[0].channel, results[0].data, results[0].width * results[0].channel);
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
    free_sd_ctx(sd_ctx);
    LOGI("[%lld ms] sd_ctx freed", elapsed_ms());

    env->ReleaseStringUTFChars(jPrompt, prompt);
    env->ReleaseStringUTFChars(jModelPath, model_path);
    env->ReleaseStringUTFChars(jLoraPath, lora_path);
    env->ReleaseStringUTFChars(jOutputPath, output_path);

    LOGI("========================================");
    LOGI("[%lld ms] generateImage() TOTAL completed", elapsed_ms());
    LOGI("========================================");

    sd_set_progress_callback(nullptr, nullptr);
    sd_set_log_callback(nullptr, nullptr);

    return env->NewStringUTF(result_path.c_str());
}
