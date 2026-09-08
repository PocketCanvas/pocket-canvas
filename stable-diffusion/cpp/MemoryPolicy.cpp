#include "MemoryPolicy.h"

#include <cstdint>
#include <cstring>

namespace pocket_canvas {

ResolvedMemoryPolicy resolve_memory_policy(
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

}  // namespace pocket_canvas
