# Android NDK has no OpenCL package. Pocket Canvas builds Khronos ICD loader
# first and this module satisfies ggml-opencl's find_package(OpenCL REQUIRED).
if(NOT TARGET OpenCL)
    message(FATAL_ERROR "OpenCL ICD loader must be added before find_package(OpenCL)")
endif()

set(OpenCL_INCLUDE_DIR "${POCKET_CANVAS_OPENCL_HEADERS_DIR}")
set(OpenCL_INCLUDE_DIRS "${POCKET_CANVAS_OPENCL_HEADERS_DIR}")
set(OpenCL_LIBRARY OpenCL)
set(OpenCL_LIBRARIES OpenCL)
set(OpenCL_FOUND TRUE)

if(NOT TARGET OpenCL::OpenCL)
    add_library(OpenCL::OpenCL ALIAS OpenCL)
endif()

include(FindPackageHandleStandardArgs)
find_package_handle_standard_args(OpenCL REQUIRED_VARS OpenCL_INCLUDE_DIR OpenCL_LIBRARIES)
