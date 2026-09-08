#include "NativeLogCollector.h"

#include <utility>

namespace pocket_canvas {

namespace {
std::string sanitize_native_log(const char* text) {
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
}

void NativeLogCollector::push(const char* text) {
    std::string line = sanitize_native_log(text);
    if (line.empty()) return;
    if (lines_.size() >= 40) lines_.pop_front();
    lines_.push_back(std::move(line));
}

const std::deque<std::string>& NativeLogCollector::lines() const {
    return lines_;
}

}  // namespace pocket_canvas
