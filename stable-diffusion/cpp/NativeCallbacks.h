#pragma once

#include "GenerationDiagnostics.h"
#include "stable-diffusion.cpp/include/stable-diffusion.h"

#include <chrono>
#include <jni.h>

namespace pocket_canvas {

using Clock = std::chrono::steady_clock;

struct ScopedCallbacksReset {
    ~ScopedCallbacksReset();
};

double elapsed_seconds(const Clock::time_point& start);

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

struct QuantizationProgressContext {
    JavaVM* java_vm;
    jobject module;
    jmethodID emit_progress;
};

void emit_progress(ProgressLogContext* context, const char* stage, int step = 0, int steps = 0);
void android_sd_log_callback(sd_log_level_t level, const char* text, void* data);
void android_quantization_log_callback(sd_log_level_t level, const char* text, void* data);
void android_quantization_progress_callback(int step, int steps, float elapsed, void* data);
void android_progress_callback(int step, int steps, float elapsed, void* data);
void log_available_devices();

}  // namespace pocket_canvas
