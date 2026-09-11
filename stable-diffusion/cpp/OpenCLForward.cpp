#define CL_TARGET_OPENCL_VERSION 300
#define CL_USE_DEPRECATED_OPENCL_1_2_APIS

#include <CL/cl.h>
#include <CL/cl_ext.h>

#include <android/log.h>
#include <dlfcn.h>

#include <mutex>

#define LOG_TAG "StableDiffusionBridge"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace {

void* load_sphal(const char* name) {
    void* vndk = dlopen("libvndksupport.so", RTLD_NOW);
    if (!vndk) return nullptr;
    using LoadSphal = void* (*)(const char*, int);
    auto load = reinterpret_cast<LoadSphal>(dlsym(vndk, "android_load_sphal_library"));
    if (!load) return nullptr;
    return load(name, RTLD_NOW);
}

void* vendor_handle() {
    static void* handle = nullptr;
    static std::once_flag once;
    std::call_once(once, [] {
        const char* paths[] = {
            "/vendor/lib64/libOpenCL.so",
            "/system/vendor/lib64/libOpenCL.so",
        };
        for (const char* path : paths) {
            dlerror();
            handle = dlopen(path, RTLD_NOW);
            if (handle) {
                LOGI("[opencl] vendor=%s", path);
                return;
            }
        }
        dlerror();
        handle = load_sphal("libOpenCL.so");
        if (handle) {
            LOGI("[opencl] vendor=sphal libOpenCL.so");
            return;
        }
        LOGE("[opencl] vendor libOpenCL.so not found");
    });
    return handle;
}

void* vendor_sym(const char* name) {
    void* library = vendor_handle();
    return library ? dlsym(library, name) : nullptr;
}

template <typename Fn>
Fn load_fn(const char* name) {
    return reinterpret_cast<Fn>(vendor_sym(name));
}

cl_int missing_int() {
    return CL_PLATFORM_NOT_FOUND_KHR;
}

void missing_ptr(cl_int* errcode_ret) {
    if (errcode_ret) *errcode_ret = CL_PLATFORM_NOT_FOUND_KHR;
}

}  // namespace

extern "C" {

CL_API_ENTRY cl_int CL_API_CALL clGetPlatformIDs(
    cl_uint num_entries,
    cl_platform_id* platforms,
    cl_uint* num_platforms
) {
    static const auto fn =
        load_fn<cl_int (*)(cl_uint, cl_platform_id*, cl_uint*)>("clGetPlatformIDs");
    return fn ? fn(num_entries, platforms, num_platforms) : missing_int();
}

CL_API_ENTRY cl_int CL_API_CALL clGetPlatformInfo(
    cl_platform_id platform,
    cl_platform_info param_name,
    size_t param_value_size,
    void* param_value,
    size_t* param_value_size_ret
) {
    static const auto fn = load_fn<cl_int (*)(cl_platform_id, cl_platform_info, size_t, void*, size_t*)>(
        "clGetPlatformInfo"
    );
    return fn ? fn(platform, param_name, param_value_size, param_value, param_value_size_ret)
              : missing_int();
}

CL_API_ENTRY cl_int CL_API_CALL clGetDeviceIDs(
    cl_platform_id platform,
    cl_device_type device_type,
    cl_uint num_entries,
    cl_device_id* devices,
    cl_uint* num_devices
) {
    static const auto fn =
        load_fn<cl_int (*)(cl_platform_id, cl_device_type, cl_uint, cl_device_id*, cl_uint*)>(
            "clGetDeviceIDs"
        );
    return fn ? fn(platform, device_type, num_entries, devices, num_devices) : missing_int();
}

CL_API_ENTRY cl_int CL_API_CALL clGetDeviceInfo(
    cl_device_id device,
    cl_device_info param_name,
    size_t param_value_size,
    void* param_value,
    size_t* param_value_size_ret
) {
    static const auto fn =
        load_fn<cl_int (*)(cl_device_id, cl_device_info, size_t, void*, size_t*)>("clGetDeviceInfo");
    return fn ? fn(device, param_name, param_value_size, param_value, param_value_size_ret)
              : missing_int();
}

CL_API_ENTRY cl_context CL_API_CALL clCreateContext(
    const cl_context_properties* properties,
    cl_uint num_devices,
    const cl_device_id* devices,
    void(CL_CALLBACK* pfn_notify)(const char*, const void*, size_t, void*),
    void* user_data,
    cl_int* errcode_ret
) {
    static const auto fn = load_fn<cl_context (*)(
        const cl_context_properties*,
        cl_uint,
        const cl_device_id*,
        void(CL_CALLBACK*)(const char*, const void*, size_t, void*),
        void*,
        cl_int*
    )>("clCreateContext");
    if (!fn) {
        missing_ptr(errcode_ret);
        return nullptr;
    }
    return fn(properties, num_devices, devices, pfn_notify, user_data, errcode_ret);
}

CL_API_ENTRY cl_command_queue CL_API_CALL clCreateCommandQueue(
    cl_context context,
    cl_device_id device,
    cl_command_queue_properties properties,
    cl_int* errcode_ret
) {
    static const auto fn =
        load_fn<cl_command_queue (*)(cl_context, cl_device_id, cl_command_queue_properties, cl_int*)>(
            "clCreateCommandQueue"
        );
    if (!fn) {
        missing_ptr(errcode_ret);
        return nullptr;
    }
    return fn(context, device, properties, errcode_ret);
}

CL_API_ENTRY cl_mem CL_API_CALL clCreateBuffer(
    cl_context context,
    cl_mem_flags flags,
    size_t size,
    void* host_ptr,
    cl_int* errcode_ret
) {
    static const auto fn =
        load_fn<cl_mem (*)(cl_context, cl_mem_flags, size_t, void*, cl_int*)>("clCreateBuffer");
    if (!fn) {
        missing_ptr(errcode_ret);
        return nullptr;
    }
    return fn(context, flags, size, host_ptr, errcode_ret);
}

CL_API_ENTRY cl_mem CL_API_CALL clCreateBufferWithProperties(
    cl_context context,
    const cl_mem_properties* properties,
    cl_mem_flags flags,
    size_t size,
    void* host_ptr,
    cl_int* errcode_ret
) {
    static const auto fn =
        load_fn<cl_mem (*)(cl_context, const cl_mem_properties*, cl_mem_flags, size_t, void*, cl_int*)>(
            "clCreateBufferWithProperties"
        );
    if (!fn) {
        missing_ptr(errcode_ret);
        return nullptr;
    }
    return fn(context, properties, flags, size, host_ptr, errcode_ret);
}

CL_API_ENTRY cl_mem CL_API_CALL clCreateImage(
    cl_context context,
    cl_mem_flags flags,
    const cl_image_format* image_format,
    const cl_image_desc* image_desc,
    void* host_ptr,
    cl_int* errcode_ret
) {
    static const auto fn = load_fn<cl_mem (*)(
        cl_context,
        cl_mem_flags,
        const cl_image_format*,
        const cl_image_desc*,
        void*,
        cl_int*
    )>("clCreateImage");
    if (!fn) {
        missing_ptr(errcode_ret);
        return nullptr;
    }
    return fn(context, flags, image_format, image_desc, host_ptr, errcode_ret);
}

CL_API_ENTRY cl_mem CL_API_CALL clCreateSubBuffer(
    cl_mem buffer,
    cl_mem_flags flags,
    cl_buffer_create_type buffer_create_type,
    const void* buffer_create_info,
    cl_int* errcode_ret
) {
    static const auto fn =
        load_fn<cl_mem (*)(cl_mem, cl_mem_flags, cl_buffer_create_type, const void*, cl_int*)>(
            "clCreateSubBuffer"
        );
    if (!fn) {
        missing_ptr(errcode_ret);
        return nullptr;
    }
    return fn(buffer, flags, buffer_create_type, buffer_create_info, errcode_ret);
}

CL_API_ENTRY cl_program CL_API_CALL clCreateProgramWithSource(
    cl_context context,
    cl_uint count,
    const char** strings,
    const size_t* lengths,
    cl_int* errcode_ret
) {
    static const auto fn =
        load_fn<cl_program (*)(cl_context, cl_uint, const char**, const size_t*, cl_int*)>(
            "clCreateProgramWithSource"
        );
    if (!fn) {
        missing_ptr(errcode_ret);
        return nullptr;
    }
    return fn(context, count, strings, lengths, errcode_ret);
}

CL_API_ENTRY cl_program CL_API_CALL clCreateProgramWithBinary(
    cl_context context,
    cl_uint num_devices,
    const cl_device_id* device_list,
    const size_t* lengths,
    const unsigned char** binaries,
    cl_int* binary_status,
    cl_int* errcode_ret
) {
    static const auto fn = load_fn<cl_program (*)(
        cl_context,
        cl_uint,
        const cl_device_id*,
        const size_t*,
        const unsigned char**,
        cl_int*,
        cl_int*
    )>("clCreateProgramWithBinary");
    if (!fn) {
        missing_ptr(errcode_ret);
        return nullptr;
    }
    return fn(context, num_devices, device_list, lengths, binaries, binary_status, errcode_ret);
}

CL_API_ENTRY cl_int CL_API_CALL clBuildProgram(
    cl_program program,
    cl_uint num_devices,
    const cl_device_id* device_list,
    const char* options,
    void(CL_CALLBACK* pfn_notify)(cl_program, void*),
    void* user_data
) {
    static const auto fn = load_fn<cl_int (*)(
        cl_program,
        cl_uint,
        const cl_device_id*,
        const char*,
        void(CL_CALLBACK*)(cl_program, void*),
        void*
    )>("clBuildProgram");
    return fn ? fn(program, num_devices, device_list, options, pfn_notify, user_data)
              : missing_int();
}

CL_API_ENTRY cl_int CL_API_CALL clCompileProgram(
    cl_program program,
    cl_uint num_devices,
    const cl_device_id* device_list,
    const char* options,
    cl_uint num_input_headers,
    const cl_program* input_headers,
    const char** header_include_names,
    void(CL_CALLBACK* pfn_notify)(cl_program, void*),
    void* user_data
) {
    static const auto fn = load_fn<cl_int (*)(
        cl_program,
        cl_uint,
        const cl_device_id*,
        const char*,
        cl_uint,
        const cl_program*,
        const char**,
        void(CL_CALLBACK*)(cl_program, void*),
        void*
    )>("clCompileProgram");
    return fn ? fn(
                    program,
                    num_devices,
                    device_list,
                    options,
                    num_input_headers,
                    input_headers,
                    header_include_names,
                    pfn_notify,
                    user_data
                )
              : missing_int();
}

CL_API_ENTRY cl_program CL_API_CALL clLinkProgram(
    cl_context context,
    cl_uint num_devices,
    const cl_device_id* device_list,
    const char* options,
    cl_uint num_input_programs,
    const cl_program* input_programs,
    void(CL_CALLBACK* pfn_notify)(cl_program, void*),
    void* user_data,
    cl_int* errcode_ret
) {
    static const auto fn = load_fn<cl_program (*)(
        cl_context,
        cl_uint,
        const cl_device_id*,
        const char*,
        cl_uint,
        const cl_program*,
        void(CL_CALLBACK*)(cl_program, void*),
        void*,
        cl_int*
    )>("clLinkProgram");
    if (!fn) {
        missing_ptr(errcode_ret);
        return nullptr;
    }
    return fn(
        context,
        num_devices,
        device_list,
        options,
        num_input_programs,
        input_programs,
        pfn_notify,
        user_data,
        errcode_ret
    );
}

CL_API_ENTRY cl_kernel CL_API_CALL clCreateKernel(
    cl_program program,
    const char* kernel_name,
    cl_int* errcode_ret
) {
    static const auto fn =
        load_fn<cl_kernel (*)(cl_program, const char*, cl_int*)>("clCreateKernel");
    if (!fn) {
        missing_ptr(errcode_ret);
        return nullptr;
    }
    return fn(program, kernel_name, errcode_ret);
}

CL_API_ENTRY cl_int CL_API_CALL clSetKernelArg(
    cl_kernel kernel,
    cl_uint arg_index,
    size_t arg_size,
    const void* arg_value
) {
    static const auto fn =
        load_fn<cl_int (*)(cl_kernel, cl_uint, size_t, const void*)>("clSetKernelArg");
    return fn ? fn(kernel, arg_index, arg_size, arg_value) : missing_int();
}

CL_API_ENTRY cl_int CL_API_CALL clEnqueueNDRangeKernel(
    cl_command_queue command_queue,
    cl_kernel kernel,
    cl_uint work_dim,
    const size_t* global_work_offset,
    const size_t* global_work_size,
    const size_t* local_work_size,
    cl_uint num_events_in_wait_list,
    const cl_event* event_wait_list,
    cl_event* event
) {
    static const auto fn = load_fn<cl_int (*)(
        cl_command_queue,
        cl_kernel,
        cl_uint,
        const size_t*,
        const size_t*,
        const size_t*,
        cl_uint,
        const cl_event*,
        cl_event*
    )>("clEnqueueNDRangeKernel");
    return fn ? fn(
                    command_queue,
                    kernel,
                    work_dim,
                    global_work_offset,
                    global_work_size,
                    local_work_size,
                    num_events_in_wait_list,
                    event_wait_list,
                    event
                )
              : missing_int();
}

CL_API_ENTRY cl_int CL_API_CALL clEnqueueReadBuffer(
    cl_command_queue command_queue,
    cl_mem buffer,
    cl_bool blocking_read,
    size_t offset,
    size_t size,
    void* ptr,
    cl_uint num_events_in_wait_list,
    const cl_event* event_wait_list,
    cl_event* event
) {
    static const auto fn = load_fn<cl_int (*)(
        cl_command_queue,
        cl_mem,
        cl_bool,
        size_t,
        size_t,
        void*,
        cl_uint,
        const cl_event*,
        cl_event*
    )>("clEnqueueReadBuffer");
    return fn ? fn(
                    command_queue,
                    buffer,
                    blocking_read,
                    offset,
                    size,
                    ptr,
                    num_events_in_wait_list,
                    event_wait_list,
                    event
                )
              : missing_int();
}

CL_API_ENTRY cl_int CL_API_CALL clEnqueueWriteBuffer(
    cl_command_queue command_queue,
    cl_mem buffer,
    cl_bool blocking_write,
    size_t offset,
    size_t size,
    const void* ptr,
    cl_uint num_events_in_wait_list,
    const cl_event* event_wait_list,
    cl_event* event
) {
    static const auto fn = load_fn<cl_int (*)(
        cl_command_queue,
        cl_mem,
        cl_bool,
        size_t,
        size_t,
        const void*,
        cl_uint,
        const cl_event*,
        cl_event*
    )>("clEnqueueWriteBuffer");
    return fn ? fn(
                    command_queue,
                    buffer,
                    blocking_write,
                    offset,
                    size,
                    ptr,
                    num_events_in_wait_list,
                    event_wait_list,
                    event
                )
              : missing_int();
}

CL_API_ENTRY cl_int CL_API_CALL clEnqueueCopyBuffer(
    cl_command_queue command_queue,
    cl_mem src_buffer,
    cl_mem dst_buffer,
    size_t src_offset,
    size_t dst_offset,
    size_t size,
    cl_uint num_events_in_wait_list,
    const cl_event* event_wait_list,
    cl_event* event
) {
    static const auto fn = load_fn<cl_int (*)(
        cl_command_queue,
        cl_mem,
        cl_mem,
        size_t,
        size_t,
        size_t,
        cl_uint,
        const cl_event*,
        cl_event*
    )>("clEnqueueCopyBuffer");
    return fn ? fn(
                    command_queue,
                    src_buffer,
                    dst_buffer,
                    src_offset,
                    dst_offset,
                    size,
                    num_events_in_wait_list,
                    event_wait_list,
                    event
                )
              : missing_int();
}

CL_API_ENTRY cl_int CL_API_CALL clEnqueueFillBuffer(
    cl_command_queue command_queue,
    cl_mem buffer,
    const void* pattern,
    size_t pattern_size,
    size_t offset,
    size_t size,
    cl_uint num_events_in_wait_list,
    const cl_event* event_wait_list,
    cl_event* event
) {
    static const auto fn = load_fn<cl_int (*)(
        cl_command_queue,
        cl_mem,
        const void*,
        size_t,
        size_t,
        size_t,
        cl_uint,
        const cl_event*,
        cl_event*
    )>("clEnqueueFillBuffer");
    return fn ? fn(
                    command_queue,
                    buffer,
                    pattern,
                    pattern_size,
                    offset,
                    size,
                    num_events_in_wait_list,
                    event_wait_list,
                    event
                )
              : missing_int();
}

CL_API_ENTRY cl_int CL_API_CALL clEnqueueBarrierWithWaitList(
    cl_command_queue command_queue,
    cl_uint num_events_in_wait_list,
    const cl_event* event_wait_list,
    cl_event* event
) {
    static const auto fn =
        load_fn<cl_int (*)(cl_command_queue, cl_uint, const cl_event*, cl_event*)>(
            "clEnqueueBarrierWithWaitList"
        );
    return fn ? fn(command_queue, num_events_in_wait_list, event_wait_list, event) : missing_int();
}

CL_API_ENTRY cl_int CL_API_CALL clEnqueueMarkerWithWaitList(
    cl_command_queue command_queue,
    cl_uint num_events_in_wait_list,
    const cl_event* event_wait_list,
    cl_event* event
) {
    static const auto fn =
        load_fn<cl_int (*)(cl_command_queue, cl_uint, const cl_event*, cl_event*)>(
            "clEnqueueMarkerWithWaitList"
        );
    return fn ? fn(command_queue, num_events_in_wait_list, event_wait_list, event) : missing_int();
}

CL_API_ENTRY cl_int CL_API_CALL clFlush(cl_command_queue command_queue) {
    static const auto fn = load_fn<cl_int (*)(cl_command_queue)>("clFlush");
    return fn ? fn(command_queue) : missing_int();
}

CL_API_ENTRY cl_int CL_API_CALL clFinish(cl_command_queue command_queue) {
    static const auto fn = load_fn<cl_int (*)(cl_command_queue)>("clFinish");
    return fn ? fn(command_queue) : missing_int();
}

CL_API_ENTRY cl_int CL_API_CALL clWaitForEvents(cl_uint num_events, const cl_event* event_list) {
    static const auto fn = load_fn<cl_int (*)(cl_uint, const cl_event*)>("clWaitForEvents");
    return fn ? fn(num_events, event_list) : missing_int();
}

CL_API_ENTRY cl_int CL_API_CALL clGetEventProfilingInfo(
    cl_event event,
    cl_profiling_info param_name,
    size_t param_value_size,
    void* param_value,
    size_t* param_value_size_ret
) {
    static const auto fn =
        load_fn<cl_int (*)(cl_event, cl_profiling_info, size_t, void*, size_t*)>(
            "clGetEventProfilingInfo"
        );
    return fn ? fn(event, param_name, param_value_size, param_value, param_value_size_ret)
              : missing_int();
}

CL_API_ENTRY cl_int CL_API_CALL clGetKernelInfo(
    cl_kernel kernel,
    cl_kernel_info param_name,
    size_t param_value_size,
    void* param_value,
    size_t* param_value_size_ret
) {
    static const auto fn =
        load_fn<cl_int (*)(cl_kernel, cl_kernel_info, size_t, void*, size_t*)>("clGetKernelInfo");
    return fn ? fn(kernel, param_name, param_value_size, param_value, param_value_size_ret)
              : missing_int();
}

CL_API_ENTRY cl_int CL_API_CALL clGetKernelWorkGroupInfo(
    cl_kernel kernel,
    cl_device_id device,
    cl_kernel_work_group_info param_name,
    size_t param_value_size,
    void* param_value,
    size_t* param_value_size_ret
) {
    static const auto fn =
        load_fn<cl_int (*)(cl_kernel, cl_device_id, cl_kernel_work_group_info, size_t, void*, size_t*)>(
            "clGetKernelWorkGroupInfo"
        );
    return fn ? fn(kernel, device, param_name, param_value_size, param_value, param_value_size_ret)
              : missing_int();
}

CL_API_ENTRY cl_int CL_API_CALL clGetKernelSubGroupInfo(
    cl_kernel kernel,
    cl_device_id device,
    cl_kernel_sub_group_info param_name,
    size_t input_value_size,
    const void* input_value,
    size_t param_value_size,
    void* param_value,
    size_t* param_value_size_ret
) {
    static const auto fn = load_fn<cl_int (*)(
        cl_kernel,
        cl_device_id,
        cl_kernel_sub_group_info,
        size_t,
        const void*,
        size_t,
        void*,
        size_t*
    )>("clGetKernelSubGroupInfo");
    return fn ? fn(
                    kernel,
                    device,
                    param_name,
                    input_value_size,
                    input_value,
                    param_value_size,
                    param_value,
                    param_value_size_ret
                )
              : missing_int();
}

CL_API_ENTRY cl_int CL_API_CALL clGetProgramInfo(
    cl_program program,
    cl_program_info param_name,
    size_t param_value_size,
    void* param_value,
    size_t* param_value_size_ret
) {
    static const auto fn =
        load_fn<cl_int (*)(cl_program, cl_program_info, size_t, void*, size_t*)>("clGetProgramInfo");
    return fn ? fn(program, param_name, param_value_size, param_value, param_value_size_ret)
              : missing_int();
}

CL_API_ENTRY cl_int CL_API_CALL clGetProgramBuildInfo(
    cl_program program,
    cl_device_id device,
    cl_program_build_info param_name,
    size_t param_value_size,
    void* param_value,
    size_t* param_value_size_ret
) {
    static const auto fn =
        load_fn<cl_int (*)(cl_program, cl_device_id, cl_program_build_info, size_t, void*, size_t*)>(
            "clGetProgramBuildInfo"
        );
    return fn ? fn(program, device, param_name, param_value_size, param_value, param_value_size_ret)
              : missing_int();
}

CL_API_ENTRY cl_int CL_API_CALL clReleaseEvent(cl_event event) {
    static const auto fn = load_fn<cl_int (*)(cl_event)>("clReleaseEvent");
    return fn ? fn(event) : missing_int();
}

CL_API_ENTRY cl_int CL_API_CALL clReleaseKernel(cl_kernel kernel) {
    static const auto fn = load_fn<cl_int (*)(cl_kernel)>("clReleaseKernel");
    return fn ? fn(kernel) : missing_int();
}

CL_API_ENTRY cl_int CL_API_CALL clReleaseMemObject(cl_mem memobj) {
    static const auto fn = load_fn<cl_int (*)(cl_mem)>("clReleaseMemObject");
    return fn ? fn(memobj) : missing_int();
}

CL_API_ENTRY cl_int CL_API_CALL clReleaseProgram(cl_program program) {
    static const auto fn = load_fn<cl_int (*)(cl_program)>("clReleaseProgram");
    return fn ? fn(program) : missing_int();
}

}  // extern "C"
