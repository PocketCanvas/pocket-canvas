#pragma once

#include <deque>
#include <string>

namespace pocket_canvas {

std::string sanitize_native_log(const char* text);

class NativeLogCollector {
public:
    void push(const char* text);
    const std::deque<std::string>& lines() const;

private:
    std::deque<std::string> lines_;
};

}  // namespace pocket_canvas
