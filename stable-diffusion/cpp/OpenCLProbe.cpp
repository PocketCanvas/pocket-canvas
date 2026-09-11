#define CL_TARGET_OPENCL_VERSION 300
#define CL_USE_DEPRECATED_OPENCL_1_2_APIS

#include "OpenCLProbe.h"

#include <CL/cl.h>

#include <dlfcn.h>

#include <sstream>
#include <string>
#include <vector>

namespace pocket_canvas {
namespace {

struct OpenCLApi {
    cl_int (*clGetPlatformIDs)(cl_uint, cl_platform_id*, cl_uint*) = nullptr;
    cl_int (*clGetDeviceIDs)(cl_platform_id, cl_device_type, cl_uint, cl_device_id*, cl_uint*) = nullptr;
    cl_int (*clGetPlatformInfo)(cl_platform_id, cl_platform_info, size_t, void*, size_t*) = nullptr;
    cl_int (*clGetDeviceInfo)(cl_device_id, cl_device_info, size_t, void*, size_t*) = nullptr;
};

const char* cl_error_name(cl_int err) {
    switch (err) {
        case CL_SUCCESS:
            return "CL_SUCCESS";
        case CL_DEVICE_NOT_FOUND:
            return "CL_DEVICE_NOT_FOUND";
        case -1001:
            return "CL_PLATFORM_NOT_FOUND_KHR";
        default:
            return "unknown";
    }
}

std::string describe_devices(const OpenCLApi& api) {
    cl_uint platform_count = 0;
    cl_int err = api.clGetPlatformIDs(0, nullptr, &platform_count);
    if (err != CL_SUCCESS) {
        return std::string("clGetPlatformIDs failed: ") + std::to_string(err) + " (" + cl_error_name(err) +
               ")";
    }

    std::ostringstream out;
    out << "platforms: " << platform_count;
    if (platform_count == 0) return out.str();

    std::vector<cl_platform_id> platforms(platform_count);
    err = api.clGetPlatformIDs(platform_count, platforms.data(), nullptr);
    if (err != CL_SUCCESS) {
        return "clGetPlatformIDs(list) failed: " + std::to_string(err) + " (" + cl_error_name(err) + ")";
    }

    out << "\n";
    for (cl_uint platform_index = 0; platform_index < platform_count; ++platform_index) {
        const cl_platform_id platform = platforms[platform_index];
        size_t name_size = 0;
        std::string name = "unknown";
        if (api.clGetPlatformInfo(platform, CL_PLATFORM_NAME, 0, nullptr, &name_size) == CL_SUCCESS &&
            name_size > 0) {
            name.assign(name_size, '\0');
            if (api.clGetPlatformInfo(platform, CL_PLATFORM_NAME, name_size, name.data(), nullptr) ==
                CL_SUCCESS) {
                while (!name.empty() && name.back() == '\0') name.pop_back();
            }
        }
        out << "[" << platform_index << "] " << (name.empty() ? "unknown" : name) << "\n";

        cl_uint device_count = 0;
        err = api.clGetDeviceIDs(platform, CL_DEVICE_TYPE_GPU, 0, nullptr, &device_count);
        if (err == CL_DEVICE_NOT_FOUND) {
            out << "  gpu devices: 0\n";
            continue;
        }
        if (err != CL_SUCCESS) {
            out << "  clGetDeviceIDs failed: " << err << " (" << cl_error_name(err) << ")\n";
            continue;
        }

        out << "  gpu devices: " << device_count << "\n";
        if (device_count == 0) continue;

        std::vector<cl_device_id> devices(device_count);
        err = api.clGetDeviceIDs(platform, CL_DEVICE_TYPE_GPU, device_count, devices.data(), nullptr);
        if (err != CL_SUCCESS) {
            out << "  clGetDeviceIDs(list) failed: " << err << " (" << cl_error_name(err) << ")\n";
            continue;
        }

        for (cl_uint device_index = 0; device_index < device_count; ++device_index) {
            size_t device_name_size = 0;
            std::string device_name = "unknown";
            if (api.clGetDeviceInfo(devices[device_index], CL_DEVICE_NAME, 0, nullptr, &device_name_size) ==
                    CL_SUCCESS &&
                device_name_size > 0) {
                device_name.assign(device_name_size, '\0');
                if (api.clGetDeviceInfo(
                        devices[device_index], CL_DEVICE_NAME, device_name_size, device_name.data(), nullptr
                    ) == CL_SUCCESS) {
                    while (!device_name.empty() && device_name.back() == '\0') device_name.pop_back();
                }
            }
            out << "    [" << device_index << "] " << (device_name.empty() ? "unknown" : device_name) << "\n";
        }
    }

    std::string result = out.str();
    while (!result.empty() && result.back() == '\n') result.pop_back();
    return result;
}

bool load_api(void* handle, OpenCLApi* api, std::string* error) {
    api->clGetPlatformIDs = reinterpret_cast<decltype(api->clGetPlatformIDs)>(dlsym(handle, "clGetPlatformIDs"));
    api->clGetDeviceIDs = reinterpret_cast<decltype(api->clGetDeviceIDs)>(dlsym(handle, "clGetDeviceIDs"));
    api->clGetPlatformInfo =
        reinterpret_cast<decltype(api->clGetPlatformInfo)>(dlsym(handle, "clGetPlatformInfo"));
    api->clGetDeviceInfo = reinterpret_cast<decltype(api->clGetDeviceInfo)>(dlsym(handle, "clGetDeviceInfo"));
    if (api->clGetPlatformIDs && api->clGetDeviceIDs && api->clGetPlatformInfo && api->clGetDeviceInfo) {
        return true;
    }
    *error = "missing clGet* symbols";
    return false;
}

void append_section(std::ostringstream& out, const char* title, const std::string& body) {
    if (out.tellp() > 0) out << "\n\n";
    out << title << "\n  " << body;
}

std::string indent_body(const std::string& body) {
    std::string indented;
    indented.reserve(body.size() + 8);
    indented.append("  ");
    for (size_t i = 0; i < body.size(); ++i) {
        indented.push_back(body[i]);
        if (body[i] == '\n' && i + 1 < body.size()) indented.append("  ");
    }
    return indented;
}

void probe_handle(std::ostringstream& out, const char* title, void* handle, bool close_handle) {
    if (!handle) {
        const char* error = dlerror();
        append_section(out, title, error && error[0] ? error : "dlopen returned null");
        return;
    }

    OpenCLApi api;
    std::string error;
    if (!load_api(handle, &api, &error)) {
        append_section(out, title, error);
        if (close_handle) dlclose(handle);
        return;
    }

    append_section(out, title, indent_body(describe_devices(api)).substr(2));
    if (close_handle) dlclose(handle);
}

void* load_sphal(const char* name) {
    void* vndk = dlopen("libvndksupport.so", RTLD_NOW);
    if (!vndk) return nullptr;
    using LoadSphal = void* (*)(const char*, int);
    auto load = reinterpret_cast<LoadSphal>(dlsym(vndk, "android_load_sphal_library"));
    if (!load) return nullptr;
    return load(name, RTLD_NOW);
}

}  // namespace

std::string probe_opencl() {
    std::ostringstream out;

    OpenCLApi linked = {
        clGetPlatformIDs,
        clGetDeviceIDs,
        clGetPlatformInfo,
        clGetDeviceInfo,
    };
    append_section(out, "linked ICD", indent_body(describe_devices(linked)).substr(2));

    dlerror();
    probe_handle(out, "/vendor/lib64/libOpenCL.so", dlopen("/vendor/lib64/libOpenCL.so", RTLD_NOW), true);
    dlerror();
    probe_handle(
        out,
        "/system/vendor/lib64/libOpenCL.so",
        dlopen("/system/vendor/lib64/libOpenCL.so", RTLD_NOW),
        true
    );
    dlerror();
    probe_handle(out, "sphal libOpenCL.so", load_sphal("libOpenCL.so"), true);

    return out.str();
}

}  // namespace pocket_canvas
