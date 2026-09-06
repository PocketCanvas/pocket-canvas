#include <jni.h>
#include <cstring>
#include <string>
#include <vector>
#include <chrono>
#include <algorithm>
#include <mutex>
#include <deque>
#include <cstdio>
#include <cstdint>
#include <unistd.h>
#include <android/log.h>
#include <vulkan/vulkan.h>
#include "stable-diffusion.cpp/include/stable-diffusion.h"

#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stable-diffusion.cpp/thirdparty/stb_image_write.h"

#define LOG_TAG "StableDiffusionBridge"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGW(...) __android_log_print(ANDROID_LOG_WARN, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

using Clock = std::chrono::steady_clock;
static std::mutex operation_mutex;

struct DiagnosticRecord {
    std::string path;
    std::string vulkan_device = "unknown";
    std::string vulkan_api = "unknown";
    std::string vulkan_driver = "unknown";
    const char* family = "unknown";
    const char* family_evidence = "insufficient";
    const char* variant = "unknown";
    const char* diffusion_storage = "unknown";
    const char* preset = "";
    const char* memory_source = "native-default";
    const char* memory_policy = "default";
    const char* params_backend = "default";
    const char* vae_tiling = "disabled";
    bool diffusion_fa = false;
    bool taesd = false;
    bool hires = false;
    int width = 0;
    int height = 0;
    int steps = 0;
    int lora_count = 0;
    double cfg = 0;
    int sampling_step = 0;
    std::string last_stage;
    std::string params_compute = "vulkan";
    std::deque<std::string> native_tail;
};

static std::string json_quote(const char* value) {
    std::string out = "\"";
    for (const char* cursor = value ? value : ""; *cursor; ++cursor) {
        const unsigned char character = static_cast<unsigned char>(*cursor);
        if (character == '"' || character == '\\') {
            out.push_back('\\');
            out.push_back(static_cast<char>(character));
        } else if (character < 0x20) {
            char escaped[8];
            std::snprintf(escaped, sizeof(escaped), "\\u%04x", character);
            out += escaped;
        } else {
            out.push_back(static_cast<char>(character));
        }
    }
    out.push_back('"');
    return out;
}

static void query_vulkan_identity(std::string& device, std::string& api, std::string& driver) {
    device = "unknown";
    api = "unknown";
    driver = "unknown";

    auto try_create = [](uint32_t api_version, VkInstance* instance) {
        VkApplicationInfo app_info{};
        app_info.sType = VK_STRUCTURE_TYPE_APPLICATION_INFO;
        app_info.pApplicationName = "pocket-canvas-diagnostic";
        app_info.apiVersion = api_version;
        VkInstanceCreateInfo create_info{};
        create_info.sType = VK_STRUCTURE_TYPE_INSTANCE_CREATE_INFO;
        create_info.pApplicationInfo = &app_info;
        return vkCreateInstance(&create_info, nullptr, instance) == VK_SUCCESS &&
               *instance != VK_NULL_HANDLE;
    };

    VkInstance instance = VK_NULL_HANDLE;
    if (!try_create(VK_API_VERSION_1_1, &instance) &&
        !try_create(VK_API_VERSION_1_0, &instance)) {
        return;
    }

    uint32_t count = 0;
    if (vkEnumeratePhysicalDevices(instance, &count, nullptr) != VK_SUCCESS || count == 0) {
        vkDestroyInstance(instance, nullptr);
        return;
    }
    std::vector<VkPhysicalDevice> devices(count);
    if (vkEnumeratePhysicalDevices(instance, &count, devices.data()) != VK_SUCCESS) {
        vkDestroyInstance(instance, nullptr);
        return;
    }

    VkPhysicalDeviceProperties properties{};
    vkGetPhysicalDeviceProperties(devices[0], &properties);
    device = properties.deviceName;
    char api_buf[32];
    std::snprintf(
        api_buf, sizeof(api_buf), "%u.%u.%u",
        VK_API_VERSION_MAJOR(properties.apiVersion),
        VK_API_VERSION_MINOR(properties.apiVersion),
        VK_API_VERSION_PATCH(properties.apiVersion)
    );
    api = api_buf;
    char driver_buf[32];
    std::snprintf(
        driver_buf, sizeof(driver_buf), "%u.%u.%u",
        VK_API_VERSION_MAJOR(properties.driverVersion),
        VK_API_VERSION_MINOR(properties.driverVersion),
        VK_API_VERSION_PATCH(properties.driverVersion)
    );
    driver = driver_buf;
    vkDestroyInstance(instance, nullptr);
}

static void write_generation_diagnostic(DiagnosticRecord& record, const char* stage, bool durable) {
    if (record.path.empty()) return;

    std::string json = "{\"schemaVersion\":2";
    json += ",\"kind\":\"breadcrumb\"";
    json += ",\"status\":\"running\"";
    json += ",\"stage\":";
    json += json_quote(stage);
    json += ",\"samplingStep\":";
    json += std::to_string(record.sampling_step);
    json += ",\"samplingSteps\":";
    json += std::to_string(record.steps);
    json += ",\"width\":";
    json += std::to_string(record.width);
    json += ",\"height\":";
    json += std::to_string(record.height);
    json += ",\"steps\":";
    json += std::to_string(record.steps);
    char cfg_buf[32];
    std::snprintf(cfg_buf, sizeof(cfg_buf), "%.2f", record.cfg);
    json += ",\"cfgScale\":";
    json += cfg_buf;
    json += ",\"preset\":";
    json += json_quote(record.preset);
    json += ",\"family\":";
    json += json_quote(record.family);
    json += ",\"familyEvidence\":";
    json += json_quote(record.family_evidence);
    json += ",\"variant\":";
    json += json_quote(record.variant);
    json += ",\"diffusionStorage\":";
    json += json_quote(record.diffusion_storage);
    json += ",\"loraCount\":";
    json += std::to_string(record.lora_count);
    json += ",\"taesd\":";
    json += record.taesd ? "true" : "false";
    json += ",\"hires\":";
    json += record.hires ? "true" : "false";
    json += ",\"memorySource\":";
    json += json_quote(record.memory_source);
    json += ",\"memoryPolicy\":";
    json += json_quote(record.memory_policy);
    json += ",\"diffusionFa\":";
    json += record.diffusion_fa ? "true" : "false";
    json += ",\"paramsBackend\":";
    json += json_quote(record.params_backend);
    json += ",\"backend\":{\"diffusion\":\"vulkan\",\"textEncoder\":\"vulkan\",\"vae\":\"vulkan\",\"textEncoderParams\":";
    json += json_quote(record.params_compute.c_str());
    json += "}";
    json += ",\"vaeTiling\":";
    json += json_quote(record.vae_tiling);
    json += ",\"vulkanDevice\":";
    json += json_quote(record.vulkan_device.c_str());
    json += ",\"vulkanApi\":";
    json += json_quote(record.vulkan_api.c_str());
    json += ",\"vulkanDriver\":";
    json += json_quote(record.vulkan_driver.c_str());
    json += ",\"nativeTail\":[";
    for (size_t i = 0; i < record.native_tail.size(); ++i) {
        if (i > 0) json += ",";
        json += json_quote(record.native_tail[i].c_str());
    }
    json += "]";
    json += "}";

    FILE* file = std::fopen(record.path.c_str(), "wb");
    if (!file) {
        LOGW("[diagnostic] failed to open %s", record.path.c_str());
        return;
    }
    std::fwrite(json.data(), 1, json.size(), file);
    std::fflush(file);
    if (durable) {
        fsync(fileno(file));
    }
    std::fclose(file);
    const bool stage_changed = record.last_stage != stage;
    record.last_stage = stage;
    if (stage_changed) {
        LOGI(
            "[breadcrumb] stage=%s vulkan=%s family=%s lora=%d policy=%s",
            stage, record.vulkan_api.c_str(), record.family, record.lora_count, record.memory_policy
        );
    }
}

static void clear_generation_diagnostic(const std::string& path) {
    if (!path.empty()) ::remove(path.c_str());
}

struct ScopedCallbacksReset {
    ~ScopedCallbacksReset() {
        sd_set_log_callback(nullptr, nullptr);
        sd_set_progress_callback(nullptr, nullptr);
    }
};

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
    DiagnosticRecord* diagnostic = nullptr;
};

static bool is_diagnostic_stage_enter(const char* stage, int step) {
    return (std::strcmp(stage, "loading") == 0 && step == 0) ||
           std::strcmp(stage, "encoding") == 0 ||
           std::strcmp(stage, "text_encoding_prepare") == 0 ||
           std::strcmp(stage, "text_encoding_params") == 0 ||
           std::strcmp(stage, "text_encoding_compute") == 0 ||
           (std::strcmp(stage, "sampling") == 0 && step == 0) ||
           std::strcmp(stage, "decoding") == 0;
}

static std::string sanitize_native_log(const char* text) {
    std::string line = text ? text : "";
    if (line.size() > 240) line.resize(240);
    const char* marker = "/data/data/";
    size_t found = line.find(marker);
    while (found != std::string::npos) {
        size_t files = line.find("/files/", found);
        if (files == std::string::npos) break;
        size_t end = line.find_first_of(" \t\r\n", files + 7);
        if (end == std::string::npos) end = line.size();
        line.replace(found, end - found, "<app-file>");
        found = line.find(marker);
    }
    return line;
}

static void push_native_tail(DiagnosticRecord* record, const char* text) {
    if (!record) return;
    std::string line = sanitize_native_log(text);
    if (line.empty()) return;
    if (record->native_tail.size() >= 40) record->native_tail.pop_front();
    record->native_tail.push_back(std::move(line));
}

static void emit_progress(ProgressLogContext* context, const char* stage, int step = 0, int steps = 0) {
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

static void android_sd_log_callback(sd_log_level_t level, const char* text, void* data) {
    const int priority = level == SD_LOG_ERROR ? ANDROID_LOG_ERROR
                       : level == SD_LOG_WARN  ? ANDROID_LOG_WARN
                                               : ANDROID_LOG_INFO;
    if (level >= SD_LOG_WARN) {
        __android_log_print(priority, LOG_TAG, "[stable-diffusion.cpp] %s", text);
    }
    auto* context = static_cast<ProgressLogContext*>(data);
    push_native_tail(context->diagnostic, text);
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

static void android_quantization_log_callback(sd_log_level_t level, const char* text, void*) {
    if (level < SD_LOG_WARN) return;
    const int priority = level == SD_LOG_ERROR ? ANDROID_LOG_ERROR
                                               : ANDROID_LOG_WARN;
    __android_log_print(priority, LOG_TAG, "[quantize] %s", text);
}

struct QuantizationProgressContext {
    JavaVM* java_vm;
    jobject module;
    jmethodID emit_progress;
};

static void android_quantization_progress_callback(int step, int steps, float, void* data) {
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

static bool is_supported_quantization_type(sd_type_t type) {
    return type == SD_TYPE_Q8_0 || type == SD_TYPE_Q5_0 || type == SD_TYPE_Q5_1 ||
           type == SD_TYPE_Q4_0 || type == SD_TYPE_Q4_1 || type == SD_TYPE_Q4_K;
}

struct ModelMemoryDescriptor {
    const char* family;
    const char* family_evidence;
    const char* variant;
    const char* variant_evidence;
    const char* diffusion_storage;
    double diffusion_bytes;
    const char* vae_architecture;
};

struct MemoryWorkload {
    int width;
    int height;
    bool has_lora;
    bool uses_taesd;
    bool uses_hires;
};

struct ResolvedMemoryPolicy {
    const char* source = "native-default";
    const char* id = "default";
    bool diffusion_flash_attn = false;
    const char* params_backend = nullptr;
    bool vae_tiling = false;
    int vae_tile_x = 0;
    int vae_tile_y = 0;
    float vae_overlap = 0.0f;
};

static ResolvedMemoryPolicy resolve_memory_policy(
    const ModelMemoryDescriptor& model,
    const MemoryWorkload& workload
) {
    ResolvedMemoryPolicy policy;
    const bool is_sd1 = std::strcmp(model.family, "sd1") == 0;
    const bool is_sdxl = std::strcmp(model.family, "sdxl") == 0;
    const bool is_turbo = std::strcmp(model.variant, "turbo") == 0;
    const bool is_q4 = std::strcmp(model.diffusion_storage, "q4") == 0;
    const bool is_float = std::strcmp(model.diffusion_storage, "f32") == 0 ||
                          std::strcmp(model.diffusion_storage, "f16") == 0 ||
                          std::strcmp(model.diffusion_storage, "bf16") == 0 ||
                          std::strcmp(model.diffusion_storage, "f8") == 0;
    const bool exact_512 = workload.width == 512 && workload.height == 512;
    const bool exact_768 = workload.width == 768 && workload.height == 768;
    const bool plain_generation = !workload.has_lora && !workload.uses_taesd && !workload.uses_hires;

    if (is_sdxl && is_turbo && is_float && exact_512 && plain_generation) {
        policy.source = "verified";
        policy.id = "sdxl-turbo-float-512-safe-v1";
        policy.diffusion_flash_attn = true;
        policy.params_backend = "*=cpu";
        return policy;
    }

    if (is_sdxl && is_turbo && is_q4 && exact_768 && plain_generation) {
        policy.source = "verified";
        policy.id = "sdxl-turbo-q4-768-safe-v1";
        policy.vae_tiling = true;
        policy.vae_tile_x = 48;
        policy.vae_tile_y = 48;
        policy.vae_overlap = 0.5f;
        return policy;
    }

    if ((is_sd1 || (is_sdxl && is_turbo && is_q4)) && exact_512) {
        policy.source = "verified";
        policy.id = is_sd1 ? "sd1-512-native-v1" : "sdxl-turbo-q4-512-native-v1";
        return policy;
    }

    const double conservative_residency_threshold = 2.0 * 1024.0 * 1024.0 * 1024.0;
    const bool high_sampling_pressure =
        is_sdxl &&
        (is_float || std::strcmp(model.diffusion_storage, "q8") == 0 ||
         model.diffusion_bytes >= conservative_residency_threshold);
    if (high_sampling_pressure) {
        policy.source = "conservative";
        policy.id = "large-sdxl-shared-params-v1";
        policy.diffusion_flash_attn = true;
        policy.params_backend = "*=cpu";
    }

    const int64_t pixel_count = static_cast<int64_t>(workload.width) * workload.height;
    const bool compatible_high_resolution_vae =
        (is_sd1 || is_sdxl) &&
        std::strcmp(model.vae_architecture, "autoencoder-kl") == 0 &&
        pixel_count >= 768LL * 768LL && !workload.uses_taesd && !workload.uses_hires;
    if (compatible_high_resolution_vae) {
        policy.source = "conservative";
        if (std::strcmp(policy.id, "default") == 0) {
            policy.id = "high-resolution-autoencoder-kl-v1";
        }
        policy.vae_tiling = true;
        policy.vae_tile_x = 48;
        policy.vae_tile_y = 48;
        policy.vae_overlap = 0.5f;
    }
    return policy;
}

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
    LOGI("[quantize] input=%s output=%s type=%s", input_path, output_path, type_name);
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
    jstring jDiagnosticPath
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
    const char* vae_tiling = memory_policy.vae_tiling ? "48x48@0.50" : "disabled";
    LOGI("[model] family=%s family_evidence=%s variant=%s variant_evidence=%s diffusion_storage=%s diffusion_bytes=%.0f vae=%s",
         model_family, model_family_evidence, model_variant, model_variant_evidence,
         diffusion_storage, diffusionBytes, vae_architecture);
    LOGI("[settings] hires=%s scale=%.1f steps=%d denoise=%.2f memory_source=%s memory_policy=%s output=%s",
         upscaler_type, upscaleFactor, hiresSteps, hiresDenoisingStrength,
         memory_policy.source, memory_policy.id, output_path);
    LOGI("[settings] diffusion_fa=%s params_backend=%s max_vram=disabled stream_layers=disabled vae_tiling=%s",
         memory_policy.diffusion_flash_attn ? "enabled" : "disabled",
         memory_policy.params_backend ? memory_policy.params_backend : "default", vae_tiling);

    DiagnosticRecord diagnostic;
    diagnostic.path = diagnostic_path ? diagnostic_path : "";
    diagnostic.family = model_family;
    diagnostic.family_evidence = model_family_evidence;
    diagnostic.variant = model_variant;
    diagnostic.diffusion_storage = diffusion_storage;
    diagnostic.preset = sampling_preset;
    diagnostic.memory_source = memory_policy.source;
    diagnostic.memory_policy = memory_policy.id;
    diagnostic.params_backend = memory_policy.params_backend ? memory_policy.params_backend : "default";
    diagnostic.params_compute =
        memory_policy.params_backend && std::strstr(memory_policy.params_backend, "cpu")
            ? "cpu"
            : "vulkan";
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
    ctx_params.backend = "vulkan";
    ctx_params.diffusion_flash_attn = memory_policy.diffusion_flash_attn;
    ctx_params.params_backend = memory_policy.params_backend;
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
    env->ReleaseDoubleArrayElements(jLoraWeights, lora_weights, JNI_ABORT);
    env->DeleteLocalRef(module_class);

    LOGI("[request] complete success=%d total=%.2fs", result_path.rfind("file://", 0) == 0,
         elapsed_seconds(generation_started));

    sd_set_progress_callback(nullptr, nullptr);
    sd_set_log_callback(nullptr, nullptr);

    return env->NewStringUTF(result_path.c_str());
}
