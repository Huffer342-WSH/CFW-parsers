import os

def convert_clash_party_to_cfw_simplified(input_filepath, output_filepath):
    """
    读取Clash Party脚本并进行简化替换，转换为Clash for Windows格式。

    :param input_filepath: Clash Party脚本的路径。
    :param output_filepath: 生成的Clash for Windows脚本的路径。
    """
    try:
        # 1. 定义 Clash Party 的固定开头和结尾
        PARTY_START = 'function main(config) {'
        PARTY_END = '    return config;\n}'

        # 2. 定义 Clash for Windows 对应的新开头和结尾
        CFW_START = (
            'module.exports.parse = async (raw, { axios, yaml, notify, console }, { name, url, interval, selected }) => {\n'
            '    var config = yaml.parse(raw)\n'
        )
        # CFW 的结尾必须将修改后的对象序列化为 YAML 字符串
        CFW_END = (
            '    return yaml.stringify(config)\n'
            '}'
        )

        # 3. 读取 Clash Party 脚本内容
        with open(input_filepath, 'r', encoding='utf-8') as f:
            party_content = f.read().strip() # 读取并去除首尾空白

        # 4. 执行替换操作

        # 检查开头和结尾是否符合预期
        if not party_content.startswith(PARTY_START):
            print(f"❌ 错误: 输入文件格式不匹配。开头不是 '{PARTY_START}'")
            return

        # 注意：这里我们使用 rstrip() 来处理可能的末尾空白或换行符
        if not party_content.endswith(PARTY_END.strip()):
            print(f"❌ 错误: 输入文件格式不匹配。结尾不是 '{PARTY_END}'")
            return

        # 替换开头
        cfw_content = party_content.replace(PARTY_START, CFW_START, 1)

        # 替换结尾（注意：需要先去除尾部的换行，才能准确匹配 PARTY_END）
        # 我们替换 `return config;` 这行，而不是整个 `PARTY_END`，以保持逻辑体的缩进。
        # 简单替换：将 `return config; }` 替换为 CFW 的结尾
        cfw_content = cfw_content.replace(PARTY_END, CFW_END, 1).strip()


        # 5. 写入Clash for Windows格式的脚本
        with open(output_filepath, 'w', encoding='utf-8') as f:
            f.write(cfw_content + '\n') # 确保文件末尾有换行符

        print(f"✅ 成功: 转换完成！")
        print(f"   输入文件: {input_filepath}")
        print(f"   输出文件: {output_filepath}")

    except FileNotFoundError:
        print(f"❌ 错误: 找不到输入文件: {input_filepath}")
        return
    except Exception as e:
        print(f"❌ 错误: 发生异常: {e}")
        return


# -------------------- 使用示例 --------------------

# 假设你的 Clash Party 脚本文件名为 'clash_party_script.js'
# 假设你想生成的 CFW 脚本文件名为 'clash_for_windows_script.js'

input_file = 'clash-party.js'
output_file = 'cfw.js'


# 执行转换
convert_clash_party_to_cfw_simplified(input_file, output_file)
