#include <jni.h>
#include <string>

// stable-diffusion.cpp의 헤더 파일을 포함하여 정상 컴파일되는지 확인 (ggml.h 등)
// 우선 기본 컴파일 환경 테스트를 위해 껍데기만 만들고, 추후 실제 ggml 함수를 호출하도록 수정합니다.
// #include "stable-diffusion.cpp/ggml/src/ggml.h" (헤더 경로에 따라 달라질 수 있음)

extern "C"
JNIEXPORT jstring JNICALL
Java_expo_modules_stablediffusion_StableDiffusionModule_getSystemInfo(JNIEnv *env, jobject thiz) {
    // 임시 하드코딩 반환 (추후 ggml_print_system_info() 등으로 교체)
    std::string hello = "Hello from StableDiffusion C++ Bridge!";
    return env->NewStringUTF(hello.c_str());
}
