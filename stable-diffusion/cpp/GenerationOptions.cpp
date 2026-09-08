#include "GenerationOptions.h"

#include <cstring>

namespace pocket_canvas {

bool resolve_sampling_preset(const char* preset, sample_method_t& method, scheduler_t& scheduler) {
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

sd_hires_upscaler_t resolve_builtin_upscaler(const char* type) {
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

bool is_supported_quantization_type(sd_type_t type) {
    return type == SD_TYPE_Q8_0 || type == SD_TYPE_Q5_0 || type == SD_TYPE_Q5_1 ||
           type == SD_TYPE_Q4_0 || type == SD_TYPE_Q4_1 || type == SD_TYPE_Q4_K;
}

}  // namespace pocket_canvas
