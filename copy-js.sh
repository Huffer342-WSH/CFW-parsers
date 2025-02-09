#!/bin/bash

# 固定的 cfw_parser.js 文件路径
cfw_parser_file="cfw_parser.js"
yaml_file="cfw_parsers.yaml"
proxy_url="https://example.com/profile.yaml //填写你的代理配置链接"

# 创建新的 YAML 文件并写入开头内容
echo "parsers:" > "$yaml_file"
echo "  - url: $proxy_url" >> "$yaml_file"
echo "    code: |" >> "$yaml_file"

# 逐行读取 cfw_parser.js 文件内容，并添加到 YAML 文件中
while IFS= read -r line; do
    # 添加 6 个空格并写入到 YAML 文件
    echo "      $line" >> "$yaml_file"
done < "$cfw_parser_file"

echo "已创建 $yaml_file 文件并成功复制内容。"
