#pragma once

#include "NativeLogCollector.h"

#include <string>

namespace pocket_canvas {

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
    NativeLogCollector native_tail;
};

void query_vulkan_identity(std::string& device, std::string& api, std::string& driver);
void write_generation_diagnostic(DiagnosticRecord& record, const char* stage, bool durable);
void clear_generation_diagnostic(const std::string& path);

}  // namespace pocket_canvas
