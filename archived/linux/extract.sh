#!/bin/bash

# 默认输出路径
default_output="."

# 检查输入参数
while getopts "d:" opt; do
  case $opt in
    d) output=$OPTARG;;
    *) echo "Usage: $(basename $0) [-d output_directory]"; exit 1;;
  esac
done

# 如果用户没有提供自定义路径，则使用默认路径
if [ -z "$output" ]; then
  read -p "Enter extraction path (default: $default_output): " output
  if [ -z "$output" ]; then
    output="$default_output"
  fi
fi

# 创建输出目录
mkdir -p "$output"

# 解压缩
cat x.tar.gz.part-* | tar -xzvf - -C "$output"

echo "Extraction completed to $output"

