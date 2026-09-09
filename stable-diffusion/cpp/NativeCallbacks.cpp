#include "NativeCallbacks.h"

#include <algorithm>
#include <android/log.h>
#include <cstring>
#include <string>
#include <vector>

#define LOG_TAG "StableDiffusionBridge"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace pocket_canvas {

ScopedCallbacksReset::~ScopedCallbacksReset() {
    sd_set_log_callback(nullptr, nullptr);
    sd_set_progress_callback(nullptr, nullptr);
}

double elapsed_seconds(const Clock::time_point& start) {
    return std::chrono::duration<double>(Clock::now() - start).count();
}

namespace {
bool is_diagnostic_stage_enter(const char* stage, int step) {
    return (std::strcmp(stage, "loading") == 0 && step == 0) ||
           std::strcmp(stage, "encoding") == 0 ||
           std::strcmp(stage, "text_encoding_prepare") == 0 ||
           std::strcmp(stage, "text_encoding_params") == 0 ||
           std::strcmp(stage, "text_encoding_compute") == 0 ||
           (std::strcmp(stage, "sampling") == 0 && step == 0) ||
           std::strcmp(stage, "decoding") == 0;
}
}

void emit_progress(ProgressLogContext* context, const char* stage, int step, int steps) {
    jstring j_stage = context->env->NewStringUTF(stage);
    context->env->CallVoidMethod(context->module, context->emit_progress, j_stage, step, steps);
    context->env->DeleteLocalRef(j_stage);
    if (context->env->ExceptionCheck()) {
        LOGE("Failed to emit progress event");
        context->env->ExceptionClear();
    }
    if (!context->diagnostic || !is_diagnostic_stage_enter(stage, step)) return;
    if (context->diagnostic->last_stage == stage) return;
    if (std::strcmp(stage, "encoding") == 0 &&
        (context->diagnostic->last_stage == "lora_apply" ||
         context->diagnostic->last_stage.rfind("text_encoding_", 0) == 0)) {
        return;
    }
    context->diagnostic->sampling_step = step;
    write_generation_diagnostic(*context->diagnostic, stage, true);
}

void android_sd_log_callback(sd_log_level_t level, const char* text, void* data) {
    const int priority = level == SD_LOG_ERROR ? ANDROID_LOG_ERROR
                       : level == SD_LOG_WARN  ? ANDROID_LOG_WARN
                                               : ANDROID_LOG_INFO;
    if (level >= SD_LOG_WARN) {
        const std::string sanitized = sanitize_native_log(text);
        if (!sanitized.empty()) {
            __android_log_print(priority, LOG_TAG, "[stable-diffusion.cpp] %s", sanitized.c_str());
        }
    }
    auto* context = static_cast<ProgressLogContext*>(data);
    if (context->diagnostic) context->diagnostic->native_tail.push(text);
    if (context->diagnostic &&
        (std::strstr(text, "prepared params backend buffer") != nullptr ||
         std::strstr(text, "alloc params backend buffer") != nullptr ||
         std::strstr(text, "apply_loras completed") != nullptr)) {
        const char* next = std::strstr(text, "apply_loras completed") != nullptr
            ? "text_encoding_params"
            : "text_encoding_compute";
        if (context->diagnostic->last_stage != next) {
            write_generation_diagnostic(*context->diagnostic, next, true);
        }
    }
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

void android_quantization_log_callback(sd_log_level_t level, const char* text, void*) {
    if (level < SD_LOG_WARN) return;
    const int priority = level == SD_LOG_ERROR ? ANDROID_LOG_ERROR
                                               : ANDROID_LOG_WARN;
    const std::string sanitized = sanitize_native_log(text);
    if (!sanitized.empty()) {
        __android_log_print(priority, LOG_TAG, "[quantize] %s", sanitized.c_str());
    }
}

void android_quantization_progress_callback(int step, int steps, float, void* data) {
    auto* context = static_cast<QuantizationProgressContext*>(data);
    JNIEnv* callback_env = nullptr;
    bool attached = false;
    const jint env_status = context->java_vm->GetEnv(
        reinterpret_cast<void**>(&callback_env), JNI_VERSION_1_6);
    if (env_status == JNI_EDETACHED) {
        if (context->java_vm->AttachCurrentThread(&callback_env, nullptr) != JNI_OK) {
            LOGE("[quantize] failed to attach progress callback thread");
            return;
        }
        attached = true;
    } else if (env_status != JNI_OK) {
        LOGE("[quantize] failed to get progress callback JNI environment");
        return;
    }

    callback_env->CallVoidMethod(context->module, context->emit_progress, step, steps);
    if (callback_env->ExceptionCheck()) {
        LOGE("[quantize] failed to emit progress event");
        callback_env->ExceptionClear();
    }
    if (attached) {
        context->java_vm->DetachCurrentThread();
    }
}

void android_progress_callback(int step, int steps, float, void* data) {
    auto* context = static_cast<ProgressLogContext*>(data);
    if (context->stage == ProgressLogContext::Stage::Loading) {
        emit_progress(context, "loading", step, steps);
    } else if (context->stage == ProgressLogContext::Stage::Sampling && steps == context->steps) {
        emit_progress(context, "sampling", step, steps);
    }
}

void log_available_devices() {
    const size_t required_size = sd_list_devices(nullptr, 0);
    std::vector<char> devices(required_size + 1, '\0');
    sd_list_devices(devices.data(), devices.size());
    std::replace(devices.begin(), devices.end(), '\n', ' ');
    LOGI("[vulkan] devices=%s", devices.data());
}

}  // namespace pocket_canvas
