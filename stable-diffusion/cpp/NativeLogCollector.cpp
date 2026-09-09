#include "NativeLogCollector.h"

#include <sstream>
#include <utility>

namespace pocket_canvas {

namespace {
bool contains_sensitive_field(const std::string& line) {
    static const char* fields[] = {
        "prompt:",
        "negative_prompt:",
        "split prompt \"",
        "model_path:",
        "diffusion_model_path:",
        "high_noise_diffusion_model_path:",
        "uncond_diffusion_model_path:"
    };
    for (const char* field : fields) {
        if (line.find(field) != std::string::npos) return true;
    }
    return false;
}

void redact_path_from(std::string& line, size_t start) {
    const size_t end = line.find_first_of(" \t\r\n'\"),]}", start);
    line.replace(start, (end == std::string::npos ? line.size() : end) - start, "<app-file>");
}

void redact_paths(std::string& line) {
    static const char* prefixes[] = {
        "file://", "content://", "/data/data/", "/data/user/", "/storage/emulated/"
    };
    for (const char* prefix : prefixes) {
        size_t found = line.find(prefix);
        while (found != std::string::npos) {
            redact_path_from(line, found);
            found = line.find(prefix, found + sizeof("<app-file>") - 1);
        }
    }
}
}

std::string sanitize_native_log(const char* text) {
    std::istringstream input(text ? text : "");
    std::string sanitized;
    std::string line;
    while (std::getline(input, line)) {
        if (contains_sensitive_field(line)) continue;
        redact_paths(line);
        if (line.empty()) continue;
        if (line.size() > 240) line.resize(240);
        if (!sanitized.empty()) sanitized.push_back('\n');
        sanitized += line;
    }
    return sanitized;
}

void NativeLogCollector::push(const char* text) {
    std::string line = sanitize_native_log(text);
    if (line.empty()) return;
    std::istringstream input(line);
    while (std::getline(input, line)) {
        if (lines_.size() >= 40) lines_.pop_front();
        lines_.push_back(std::move(line));
    }
}

const std::deque<std::string>& NativeLogCollector::lines() const {
    return lines_;
}

}  // namespace pocket_canvas
