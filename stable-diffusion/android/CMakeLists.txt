cmake_minimum_required(VERSION 3.22.1)
project(stable_diffusion_bridge)

# stable-diffusion.cpp 빌드 시 불필요한 예제 및 테스트 제외
set(SD_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(SD_BUILD_TESTS OFF CACHE BOOL "" FORCE)

# Vulkan 백엔드 활성화
set(SD_VULKAN ON CACHE BOOL "" FORCE)

# Android NDK에는 vulkan.hpp가 없으므로 설치된 호스트 Vulkan SDK의 C++ 헤더를 사용합니다.
if(DEFINED ENV{VULKAN_SDK})
    include_directories("$ENV{VULKAN_SDK}/Include")
endif()

# 서브모듈 디렉토리 추가
add_subdirectory(../cpp/stable-diffusion.cpp stable-diffusion)

# JNI 브릿지 라이브러리 추가
add_library(
    stable_diffusion_bridge
    SHARED
    ../cpp/StableDiffusionBridge.cpp
)

# stable-diffusion(C++ 코어 라이브러리)와 안드로이드 기본 log 라이브러리 링크
target_link_libraries(
    stable_diffusion_bridge
    stable-diffusion
    log
    vulkan
)
