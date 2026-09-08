#pragma once

#include "stable-diffusion.cpp/include/stable-diffusion.h"

namespace pocket_canvas {

bool resolve_sampling_preset(const char* preset, sample_method_t& method, scheduler_t& scheduler);
sd_hires_upscaler_t resolve_builtin_upscaler(const char* type);
bool is_supported_quantization_type(sd_type_t type);

}  // namespace pocket_canvas
