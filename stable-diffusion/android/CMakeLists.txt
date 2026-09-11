cmake_minimum_required(VERSION 3.22.1)
project(stable_diffusion_bridge)

# stable-diffusion.cpp 빌드 시 불필요한 예제 및 테스트 제외
set(SD_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(SD_BUILD_TESTS OFF CACHE BOOL "" FORCE)

# Vulkan 백엔드 활성화
set(SD_VULKAN ON CACHE BOOL "" FORCE)
# OpenCL 백엔드를 Vulkan과 같이 컴파일한다. 런타임 선택은 생성 요청의 backend가 고른다.
set(SD_OPENCL ON CACHE BOOL "" FORCE)

# Android NDK에는 vulkan.hpp가 없으므로 설치된 호스트 Vulkan SDK의 C++ 헤더를 사용합니다.
if(DEFINED ENV{VULKAN_SDK})
    include_directories("$ENV{VULKAN_SDK}/Include")
endif()

# ggml-opencl kernel embed는 호스트 Python이 필요하다.
find_package(Python3 COMPONENTS Interpreter REQUIRED)

# NDK에는 OpenCL이 없다. Khronos 헤더는 컴파일에 쓰고, 런타임은 vendor libOpenCL.so로 전달한다.
set(POCKET_CANVAS_OPENCL_HEADERS_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../cpp/OpenCL-Headers")
add_library(OpenCL SHARED ../cpp/OpenCLForward.cpp)
target_include_directories(OpenCL PRIVATE "${POCKET_CANVAS_OPENCL_HEADERS_DIR}")
target_link_libraries(OpenCL PRIVATE dl log)

# ggml-opencl의 find_package(OpenCL)가 NDK sysroot를 검색하지 않게 한다.
list(PREPEND CMAKE_MODULE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/cmake")

# 서브모듈 디렉토리 추가
add_subdirectory(../cpp/stable-diffusion.cpp stable-diffusion)

# JNI 브릿지 라이브러리 추가
add_library(
    stable_diffusion_bridge
    SHARED
    ../cpp/StableDiffusionBridge.cpp
    ../cpp/GenerationDiagnostics.cpp
    ../cpp/GenerationOptions.cpp
    ../cpp/MemoryPolicy.cpp
    ../cpp/NativeCallbacks.cpp
    ../cpp/NativeLogCollector.cpp
    ../cpp/OpenCLProbe.cpp
)

target_include_directories(
    stable_diffusion_bridge
    PRIVATE
    "${POCKET_CANVAS_OPENCL_HEADERS_DIR}"
)

# stable-diffusion(C++ 코어 라이브러리)와 안드로이드 기본 log 라이브러리 링크
target_link_libraries(
    stable_diffusion_bridge
    stable-diffusion
    log
    vulkan
    OpenCL
    dl
)
