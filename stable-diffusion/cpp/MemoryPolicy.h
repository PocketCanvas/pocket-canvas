#pragma once

namespace pocket_canvas {

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

ResolvedMemoryPolicy resolve_memory_policy(
    const ModelMemoryDescriptor& model,
    const MemoryWorkload& workload
);

}  // namespace pocket_canvas
