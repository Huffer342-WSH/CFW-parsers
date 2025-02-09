const fs = require('fs');
const yaml = require('yaml'); // 用于解析和生成 YAML
const axios = require('axios'); // 模拟 HTTP 请求
const parser = require('./cfw_parser.js'); // 引入 `parser.js`

(async () => {
    try {
        // 读取原始 YAML 文件
        const rawYaml = fs.readFileSync('1695343665245.yml', 'utf-8');

        // 模拟 Clash 调用时传递的工具对象
        const tools = {
            axios, // 提供 HTTP 请求功能
            yaml, // 提供 YAML 解析和生成功能
            notify: (message) => console.log(`[NOTIFY]: ${message}`), // 模拟通知功能
            console, // 使用 Node.js 的 console 对象
        };

        // 模拟 Clash 提供的元数据
        const metadata = {
            name: 'TestConfig', // 配置名称
            url: 'https://example.com/subscription.yaml', // 订阅地址
            interval: 3600, // 刷新间隔（秒）
            selected: true, // 是否选中当前配置
        };

        // 调用 parser.js 的 parse 方法处理 YAML 数据
        const newYaml = await parser.parse(rawYaml, tools, metadata);

        // 将结果写入到新文件
        fs.writeFileSync('output.yaml', newYaml, 'utf-8');
        console.log('YAML 文件处理完成，结果保存在 output.yaml');
    } catch (error) {
        console.error('处理 YAML 文件时出错:', error);
    }
})();
