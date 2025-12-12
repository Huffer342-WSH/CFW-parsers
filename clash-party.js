function main(config) {

    // 自动测速/选择节点组的测试间隔，单位：秒
    const autoSelectInterval = 600;
    const rulesetUpdateInterval = 64800;

    // -----------------------------------
    // 基础参数配置
    // -----------------------------------
    config["mixed-port"] = 7890;        // 混合端口（HTTP/SOCKS5）
    config["allow-lan"] = true;         // 允许局域网连接
    config["bind-address"] = "*";       // 绑定地址
    config["mode"] = "rule";            // 代理模式：规则模式
    config["log-level"] = "info";       // 日志等级

    // -----------------------------------
    // DNS 配置
    // -----------------------------------
    config["dns"] = {
        enable: true,
        ipv6: false,
        "enhanced-mode": "fake-ip",     // 启用 Fake-IP 模式
        "fake-ip-range": "198.18.0.1/16", // Fake-IP 地址范围

        // 阿里DNS和海外DNS基本一致
        // UDP的海外DNS基本都被劫持了，如8.8.8.8, 1.1.1.1等，要使用DoT和DoH的

        // 用于解析DNS的DNS （只能用IP）
        "default-nameserver": ["223.5.5.5", "tls://1.1.1.1"],

        // 用于解析节点域名的DNS，使用海外DNS
        "proxy-server-nameserver": ['223.5.5.5', 'https://doh.dns.sb/dns-query', 'tls://1.1.1.1'],

        // 域名匹配到直连的使用`nameserver`和`fallback`中设置的DNS查询，如果符合`fallback-filter`则只使用`fallback`中的
        "nameserver": ['223.5.5.5', 'https://doh.pub/dns-query', 'https://dns.alidns.com/dns-query'],

        // fallback主要用于应对一个被污染的外网URL意外走了Direct，可以通过fallback查询到真实IP并通过IP规则重新令其走代理
        // 所以如果没有针对IP设置是否走代理，fallback就没有用
        fallback: [],//'https://doh.dns.sb/dns-query', 'tls://1.1.1.1', 'https://cloudflare-dns.com/dns-query'
        "fallback-filter": {
            geoip: true,
            ipcidr: [
                "240.0.0.0/4",
                "0.0.0.0/32"
            ],
            "geoip-code": "CN",
        },

        "fake-ip-filter": [
            "*",
            "+.lan",
            "+.local",
            "time.*.com",
            "ntp.*.com",
            "+.market.xiaomi.com"
        ],
        "use-hosts": false,
        "use-system-hosts": false,
        "respect-rules": false,
    };

    // ===================================
    //  分类国家节点组 - 辅助函数
    // ===================================

   /**
    * 过滤掉高倍率节点（>1倍），保留平价节点
    */
    function filterHighMultiplierNodes(proxyNames) {
        const regex = /(\d+\.?\d*)\s*[倍xX]|[倍xX]\s*(\d+\.?\d*)/;
        return proxyNames.filter(name => {
            const match = name.match(regex);
            if (!match) return true;
            const num = parseFloat(match[1] || match[2]);
            return num <= 1;
        });
    }

    /**
     * 创建标准化的国家/地区代理组
     * @param {string[]} proxiesList 所有可用节点名称
     * @param {object} matcher 配置项 { name, emoji, match }
     */
    function createProxyGroups(proxiesList, matcher) {
        const { name, emoji, match: keywords } = matcher;

        // 筛选节点：只要包含 match 中的任意一个关键字
        const matchedProxies = proxiesList.filter(pName =>
            keywords.some(key => pName.includes(key))
        );

        // 如果该地区没有匹配到节点，直接返回 null
        if (matchedProxies.length === 0) return null;

        // 定义组名称格式
        const manualGroupName = `${emoji} ${name}`;          // 例: 🇺🇸 美国
        const autoGroupName = `♻️${emoji}${name}-自动选择`;   // 例: ♻️🇺🇸美国-自动选择

        // 1. 自动选择组 (Url-Test) - 仅使用低倍率节点
        const autoGroup = {
            name: autoGroupName,
            type: 'url-test',
            proxies: filterHighMultiplierNodes(matchedProxies),
            url: 'http://www.gstatic.com/generate_204',
            interval: 300,
            tolerance: 50
        };

        // 2. 手动选择组 (Select) - 包含自动组 + 所有匹配节点
        const manualGroup = {
            name: manualGroupName,
            type: 'select',
            proxies: [autoGroupName, ...matchedProxies]
        };

        return {
            autoGroup,     // 代理组配置对象
            manualGroup,   // 代理组配置对象
            names: {       // 返回名称用于后续列表生成
                manual: manualGroupName,
                auto: autoGroupName,
                rawName: name // 用于 AI 筛选对比
            }
        };
    }

    // ===================================
    //  分类国家节点组 - 配置定义
    // ===================================

    // 获取所有节点名称并过滤无效节点
    const proxyNameRAW = (config.proxies || []).map(p => p.name);
    const proxyNameUseful = proxyNameRAW.filter(n => !/剩余|套餐|网址|客服|过滤|时间|境外/.test(n));
    const proxyNameAuto = filterHighMultiplierNodes(proxyNameUseful);

    // 定义匹配规则：name(核心名), emoji(旗帜), match(匹配关键字)
    const proxyMatcher = [
        { name: '美国', emoji: '🇺🇸', match: ['美国', 'US', 'States', '🇺🇸'] },
        { name: '香港', emoji: '🇭🇰', match: ['香港', 'HK', 'Hong', '🇭🇰'] },
        { name: '台湾', emoji: '🇹🇼', match: ['台湾', 'TW', 'Tai', '🇹🇼'] },
        { name: '日本', emoji: '🇯🇵', match: ['日本', 'JP', 'Japan', '🇯🇵'] },
        { name: '新加坡', emoji: '🇸🇬', match: ['新加坡', 'SG', 'Singapore', '🇸🇬'] },
        { name: '韩国', emoji: '🇰🇷', match: ['韩国', 'KR', 'Korea', '🇰🇷'] },
        { name: '英国', emoji: '🇬🇧', match: ['英国', 'UK', 'Kingdom', '🇬🇧'] },
        { name: '法国', emoji: '🇫🇷', match: ['法国', 'FR', 'France', '🇫🇷'] },
        { name: '德国', emoji: '🇩🇪', match: ['德国', 'DE', 'Germany', '🇩🇪'] },
        { name: '澳大利亚', emoji: '🇦🇺', match: ['澳大利亚', 'AU', 'Australia', '🇦🇺'] },
        { name: '加拿大', emoji: '🇨🇦', match: ['加拿大', 'CA', 'Canada', '🇨🇦'] },
        { name: '土耳其', emoji: '🇹🇷', match: ['土耳其', 'TR', 'Turkey', '🇹🇷'] },
        { name: '阿根廷', emoji: '🇦🇷', match: ['阿根廷', 'AR', 'Argentina', '🇦🇷'] },
        { name: '印度', emoji: '🇮🇳', match: ['印度', 'IN', 'India', '🇮🇳'] },
        { name: '越南', emoji: '🇻🇳', match: ['越南', 'VN', 'Vietnam', '🇻🇳'] },
        { name: '俄罗斯', emoji: '🇷🇺', match: ['俄罗斯', 'RU', 'Russia', '🇷🇺'] },
    ];

    // 定义 AI 支持的地区白名单 (必须与 proxyMatcher 中的 name 一致)
    // 逻辑：只有这些地区的“自动选择”组会被加入 AI 策略
    const aiSupportedNames = ['美国', '日本', '新加坡', '台湾', '英国', '韩国', '法国', '德国'];

    // ===================================
    //  分类国家节点组 - 执行
    // ===================================

    const proxyGroupAuto = [];
    const proxyGroupManual = [];

    const proxyNameCountries = [];      // 存放所有国家的手动组名称
    const proxyNameAIAuto = [];         // 存放 AI 专用的节点，包含适用于AI的节点
    const proxyNameAI = ['自动选择-AI']; // 给Gemini等使用，包含：'自动选择-AI', 适用于AI的国家组, 适用于AI的节点

    // 遍历匹配规则生成组
    proxyMatcher.forEach(matcher => {
        const result = createProxyGroups(proxyNameUseful, matcher);

        if (result) {
            const { autoGroup, manualGroup, names } = result;

            // 1. 添加生成的组对象到列表
            proxyGroupAuto.push(autoGroup);
            proxyGroupManual.push(manualGroup);

            // 2. 记录手动组名称 (e.g. "🇺🇸 美国")
            proxyNameCountries.push(names.manual);

            // 3. AI 策略筛选：如果该国家在 AI 白名单中，提取其“自动选择组”
            if (aiSupportedNames.includes(names.rawName)) {
                // 这里存入的是: "♻️ 自动-🇺🇸 美国"
                proxyNameAI.push(names.auto);
                proxyNameAIAuto.push(...autoGroup.proxies)
            }
        }
    });



    // ===================================
    //  分类国家节点组 - 合并节点
    // ===================================

    // 常规节点组
    const proxyNameCommon = [
        'DIRECT',
        '默认代理',
        '自动选择',
        '负载均衡-轮询',
        '负载均衡-一致性哈希',
        ...proxyNameCountries, // 各国手动组: 🇺🇸 美国, 🇭🇰 香港...
        ...proxyNameUseful        // 兜底显示
    ];

    // AI 专用策略组
    proxyNameAI.push(...proxyNameAIAuto)

    // -----------------------------------
    // 应用选择组 (Stream/Service Groups)
    // -----------------------------------
    const proxyGroupStream = [
        {
            name: '默认代理',
            icon: 'https://cdn.jsdelivr.net/gh/Huffer342-WSH/Clash-for-Windwos-parsers@main/icon/Default.png',
            type: 'select',
            proxies: ['自动选择', 'DIRECT', '负载均衡-轮询', '负载均衡-一致性哈希', ...proxyNameCountries, ...proxyNameRAW]
        },
        {
            name: 'OpenAI & Genimi',
            icon: 'https://cdn.jsdelivr.net/gh/Huffer342-WSH/Clash-for-Windwos-parsers@main/icon/OpenAI.png',
            type: 'select',
            proxies: proxyNameAI
        },
        // {
        //     name: 'Gemini',
        //     icon: 'https://cdn.jsdelivr.net/gh/Huffer342-WSH/Clash-for-Windwos-parsers@main/icon/Gemini.png',
        //     type: 'select',
        //     proxies: proxyNameAI
        // },
        {
            name: 'Microsoft Copilot',
            icon: 'https://cdn.jsdelivr.net/gh/Huffer342-WSH/Clash-for-Windwos-parsers@main/icon/Microsoft%20Copilot.png',
            type: 'select',
            proxies: proxyNameCommon
        },
        {
            name: '战网',
            icon: 'https://cdn.jsdelivr.net/gh/Huffer342-WSH/Clash-for-Windwos-parsers@main/icon/Battle.png',
            type: 'select',
            proxies: proxyNameCommon
        },
        {
            name: 'Telegram',
            icon: 'https://cdn.jsdelivr.net/gh/Huffer342-WSH/Clash-for-Windwos-parsers@main/icon/Telegram.png',
            type: 'select',
            proxies: proxyNameCommon
        },
        {
            name: '苹果服务',
            icon: 'https://cdn.jsdelivr.net/gh/Huffer342-WSH/Clash-for-Windwos-parsers@main/icon/Apple.png',
            type: 'select',
            proxies: proxyNameCommon
        },
        {
            name: '微软服务 - CN',
            icon: 'https://cdn.jsdelivr.net/gh/Huffer342-WSH/Clash-for-Windwos-parsers@main/icon/Microsoft.png',
            type: 'select',
            proxies: proxyNameCommon
        },
        {
            name: '微软服务',
            icon: 'https://cdn.jsdelivr.net/gh/Huffer342-WSH/Clash-for-Windwos-parsers@main/icon/Microsoft.png',
            type: 'select',
            proxies: proxyNameCommon
        },
        // 漏网之鱼 (最终兜底选择)
        {
            name: '漏网之鱼',
            type: 'select',
            proxies: proxyNameCommon
        },

    ];

    // -----------------------------------
    // 主动代理组 (Auto/Load-Balance Groups)
    // -----------------------------------
    // 将总的自动选择和负载均衡组添加到国家/地区自动选择组列表的最前端
    proxyGroupAuto.unshift(
        // 总的 URL-Test 自动选择组
        {
            name: '自动选择',
            type: 'url-test',
            proxies: proxyNameAuto,
            url: 'http://www.gstatic.com/generate_204',
            interval: autoSelectInterval,
        },
        {
            name: '自动选择-AI',
            type: 'url-test',
            proxies: proxyNameAIAuto,
            url: 'http://www.gstatic.com/generate_204',
            interval: autoSelectInterval,
        },
        // 负载均衡 - 轮询 (Round-Robin)
        {
            name: '负载均衡-轮询',
            type: 'load-balance',
            proxies: proxyNameAuto,
            url: 'http://www.gstatic.com/generate_204',
            interval: autoSelectInterval,
            strategy: 'round-robin', // 策略：轮询
            lazy: true               // 延迟测试
        },
        // 负载均衡 - 一致性哈希 (Consistent Hashing)
        {
            name: '负载均衡-一致性哈希',
            type: 'load-balance',
            proxies: proxyNameAuto,
            url: 'http://www.gstatic.com/generate_204',
            interval: autoSelectInterval,
            strategy: 'consistent-hashing', // 策略：一致性哈希
            lazy: true
        },
    );

    // 合并所有代理组到配置中
    config['proxy-groups'] = [...proxyGroupStream, ...proxyGroupManual, ...proxyGroupAuto];

    // ===================================
    // 规则集提供者（Rule Providers）
    // ===================================

    // 定义外部规则集，方便集中管理和更新
    config['rule-providers'] = {
        // 额外添加
        'myproxy': {
            type: 'http',
            behavior: 'domain',
            format: 'text',
            url: 'https://cdn.jsdelivr.net/gh/Huffer342-WSH/Clash-for-Windwos-parsers@main/rules/proxy.list',
            interval: rulesetUpdateInterval
        },

        // Loyalsoldier
        'reject': {
            type: 'http',
            behavior: 'domain',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/reject.txt',
            interval: rulesetUpdateInterval // 每天更新
        },
        'proxy': {
            type: 'http',
            behavior: 'domain',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/proxy.txt',
            interval: rulesetUpdateInterval
        },
        'direct': {
            type: 'http',
            behavior: 'domain',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/direct.txt',
            interval: rulesetUpdateInterval
        },
        'private': {
            type: 'http',
            behavior: 'domain',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/private.txt',
            interval: rulesetUpdateInterval
        },


        'telegram-ip': {
            type: 'http',
            behavior: 'ipcidr',
            format: 'text',
            url: 'https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geoip/telegram.list',
            interval: rulesetUpdateInterval
        },
        'Microsoft-CN': {
            type: 'http',
            behavior: 'domain',
            format: 'text',
            url: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/microsoft%40cn.list",
            interval: rulesetUpdateInterval
        },
        'Microsoft': {
            type: 'http',
            behavior: 'domain',
            format: 'text',
            url: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/microsoft.list",
            interval: rulesetUpdateInterval
        },
        'Gemini': {
            type: 'http',
            behavior: 'domain',
            format: 'text',
            url: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/google-gemini.list",
            interval: rulesetUpdateInterval
        },
        'OpenAI': {
            type: 'http',
            behavior: 'domain',
            format: 'text',
            url: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo/geosite/openai.list",
            interval: rulesetUpdateInterval
        }
    };

    // ===================================
    // 规则列表（Rules）
    // ===================================
    const newRules = [
        // -----------------------------------
        // 1. 强制直连/代理规则（覆盖规则集）
        // -----------------------------------

        // Microsoft Copilot 规则
        'DOMAIN-KEYWORD,copilot.microsoft.com,Microsoft Copilot',

        // 战网
        'PROCESS-NAME,Battle.net,战网',
        'PROCESS-NAME,Battle.net.exe,战网',
        'DOMAIN-SUFFIX,battle.net,战网',
        'DOMAIN-SUFFIX,blizzard.com,战网',

        // Steam (社区代理，下载直连)
        'DOMAIN-SUFFIX,alipay.com,DIRECT',        // 支付直连
        'DOMAIN-SUFFIX,alipayobjects.com,DIRECT',
        'DOMAIN,api.steampowered.com,默认代理',
        'DOMAIN,steamcommunity.com,默认代理',
        'PROCESS-NAME,steamwebhelper,默认代理',
        'PROCESS-NAME,steamwebhelper.exe,默认代理',
        'PROCESS-NAME,steam,DIRECT',               // Steam 主进程直连
        'PROCESS-NAME,steam.exe,DIRECT',           // Steam 主进程直连

        // epic
        'DOMAIN,download.epicgames.com,DIRECT',
        'DOMAIN,fastly-download.epicgames.com,DIRECT',

        // Matlab (安装/激活直连，部分服务走代理)
        'PROCESS-NAME,MathWorksProductInstaller,DIRECT',
        'PROCESS-NAME,MathWorksProductInstaller.exe,DIRECT',
        'PROCESS-NAME,MATLABWindow,DIRECT',
        'PROCESS-NAME,MATLABWindow.exe,DIRECT',
        'DOMAIN,esd.mathworks.com,DIRECT',
        'DOMAIN-SUFFIX,mathworks.com,默认代理',

        // 雀魂
        'DOMAIN,game.maj-soul.com,默认代理',
        'DOMAIN-KEYWORD,majsoul,DIRECT',
        'DOMAIN-KEYWORD,maj-soul,DIRECT',

        // 直连的域名
        'DOMAIN,download.pytorch.org,DIRECT',
        'DOMAIN,developer.download.nvidia.com,DIRECT',
        'DOMAIN,oi-wiki.org,DIRECT',
        'DOMAIN,www.asasmr3.com,DIRECT',
        'DOMAIN,cdn2.asmrfx.com,DIRECT',
        'DOMAIN,tx.asmras.net,DIRECT',
        'DOMAIN,clash.razord.top,DIRECT', // Yacd 面板相关直连
        'DOMAIN,yacd.haishan.me,DIRECT',  // Yacd 面板相关直连
        'DOMAIN-SUFFIX,entitlenow.com,DIRECT',
        'DOMAIN-SUFFIX,codeium.com,DIRECT',
        'DOMAIN-KEYWORD,eriktse,DIRECT',
        'DOMAIN-KEYWORD,asasmr,DIRECT',
        'DOMAIN-KEYWORD,starrycoding,DIRECT',
        'DOMAIN-KEYWORD,eriktse,DIRECT',

        // -----------------------------------
        // 2. 外部规则集调用（Rule-Set Providers）
        // -----------------------------------
        // 服务专用组规则
        'RULE-SET,Microsoft-CN,微软服务 - CN',
        'RULE-SET,Microsoft,微软服务',
        'RULE-SET,Gemini,OpenAI & Genimi',
        'RULE-SET,OpenAI,OpenAI & Genimi',


        // 通用代理
        'RULE-SET,myproxy,默认代理',
        'RULE-SET,private,DIRECT',
        'RULE-SET,direct,默认代理',
        'RULE-SET,proxy,默认代理',
        'RULE-SET,reject,REJECT',

        // IP
        'RULE-SET,telegram-ip,Telegram',
        'GEOIP,LAN,DIRECT',
        'GEOIP,CN,DIRECT',

        'MATCH,漏网之鱼' // 任何未匹配的流量都走 '漏网之鱼' 代理组
    ];

    config['rules'] = newRules;

    // 返回修改后的配置
    return config;
}
