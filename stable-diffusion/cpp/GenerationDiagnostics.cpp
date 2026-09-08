#include "GenerationDiagnostics.h"

#include <android/log.h>
#include <cstdio>
#include <unistd.h>
#include <vector>
#include <vulkan/vulkan.h>

#define LOG_TAG "StableDiffusionBridge"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGW(...) __android_log_print(ANDROID_LOG_WARN, LOG_TAG, __VA_ARGS__)

namespace pocket_canvas {

namespace {
std::string json_quote(const char* value) {
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
}

void query_vulkan_identity(std::string& device, std::string& api, std::string& driver) {
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

void write_generation_diagnostic(DiagnosticRecord& record, const char* stage, bool durable) {
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
    const auto& native_tail = record.native_tail.lines();
    for (size_t i = 0; i < native_tail.size(); ++i) {
        if (i > 0) json += ",";
        json += json_quote(native_tail[i].c_str());
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

void clear_generation_diagnostic(const std::string& path) {
    if (!path.empty()) ::remove(path.c_str());
}

}  // namespace pocket_canvas
