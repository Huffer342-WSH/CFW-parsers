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
    // 辅助函数定义（Helper Functions）
    // ===================================

    /**
    * 过滤掉名称中包含高倍率（大于 1 倍）的代理节点。
    * @param {string[]} proxyNames 所有代理节点名称列表。
    * @returns {string[]} 过滤后的节点名称列表（只保留 1 倍及以下的节点）。
    */
    function filterHighMultiplierNodes(proxyNames) {
        // 通用正则：数字 + 可选小数 + 可选空格 + (倍/x/X)
        // 或者： (倍/x/X) + 可选空间 + 数字
        // 两种排列顺序都支持
        const regex = /(\d+\.?\d*)\s*[倍xX]|[倍xX]\s*(\d+\.?\d*)/;

        return proxyNames.filter(name => {
            const match = name.match(regex);

            // 没找到倍率 → 当成 1 倍，保留
            if (!match) return true;

            // match[1] 表示数字在前的情况，如 "2x"
            // match[2] 表示数字在后的情况，如 "x2"
            const numStr = match[1] || match[2];
            const num = parseFloat(numStr);

            return num <= 1;  // 只保留倍率 ≤ 1
        });
    }

    /**
     * 根据关键字创建国家/地区代理组（自动选择组和手动选择组）。
     * @param {string[]} proxiesList 所有代理节点名称列表。
     * @param {string} name 代理组的名称。
     * @param {string[]} auxStrings 用于匹配节点名称的关键字列表。
     * @returns {{autoProxyGroup: object, proxyGroup: object} | null} 创建的两个代理组或 null。
     */
    function createProxyGroups(proxiesList, name, auxStrings) {
        // 过滤出包含关键字的节点名称
        const proxyNames = proxiesList.filter(proxyName =>
            auxStrings.some(aux => proxyName.includes(aux))
        );

        if (proxyNames.length > 0) {
            // 过滤掉高倍率节点，用于 '自动选择' 组
            const filteredForAuto = filterHighMultiplierNodes(proxyNames);

            // 1. 创建 URL-Test 自动选择组
            const autoProxyGroup = {
                name: `自动选择-${name}`,
                type: 'url-test',
                proxies: filteredForAuto,
                url: 'http://www.gstatic.com/generate_204', // 测速 URL
                interval: autoSelectInterval             // 测速间隔
            };

            // 2. 创建 Select 手动选择组
            const proxyGroup = {
                name: name,
                type: 'select',
                proxies: [`自动选择-${name}`, ...proxyNames] // 包含自动选择组和所有节点
            };

            // 返回这两个组
            return { autoProxyGroup, proxyGroup };
        }
        return null; // 没有匹配到节点则返回 null
    }

    /**
     * 调用 createProxyGroups 并将生成的代理组添加到配置列表中。
     * @param {object[]} targetList 存放代理组的总列表。
     * @param {string[]} listCountry 存放生成的国家组名称的列表。
     * @param {string} name 代理组的名称。
     * @param {string[]} auxStrings 用于匹配节点名称的关键字列表。
     * @param {string[]} allProxyNames 所有代理节点名称列表。
     */
    function addProxyGroup(targetList, listCountry, name, auxStrings, allProxyNames) {
        const groupTemp = createProxyGroups(allProxyNames, name, auxStrings);
        if (groupTemp) {
            const { autoProxyGroup, proxyGroup } = groupTemp;
            targetList.push(autoProxyGroup, proxyGroup); // 添加两个组
            listCountry.push(name); // 记录国家组名称
        }
    }

    // ===================================
    // 代理组生成逻辑（Proxy Group Logic）
    // ===================================

    // 获取所有代理节点的原始名称
    const proxyNameRAW = (config.proxies || []).map(p => p.name);

    // 过滤掉不作为代理使用的特殊节点（如：剩余流量、套餐说明、网址、客服等）
    const proxyNameUseful = proxyNameRAW.filter(proxy => {
        return !proxy.includes('剩余') && !proxy.includes('套餐') && !proxy.includes('网址') && !proxy.includes('客服') && !proxy.includes('过滤') && !proxy.includes('境外');
    });

    // 自动选择组的节点列表（仅使用平价节点，即过滤掉高倍率节点）
    const proxyNameAuto = filterHighMultiplierNodes(proxyNameUseful);

    // -----------------------------------
    // 国家/地区节点组配置
    // -----------------------------------
    const proxyMatcher = [
        { name: '节点组-美国', match: ['美国', 'US', '🇺🇸'] },
        { name: '节点组-香港', match: ['香港', 'HK', '🇭🇰'] },
        { name: '节点组-台湾', match: ['台湾', 'TW'] },
        { name: '节点组-日本', match: ['日本', 'JP'] },
        { name: '节点组-韩国', match: ['韩国', 'KR'] },
        { name: '节点组-澳大利亚', match: ['澳大利亚', 'AU'] },
        { name: '节点组-新加坡', match: ['新加坡', 'SG'] },
        { name: '节点组-法国', match: ['法国', 'FR'] },
        { name: '节点组-英国', match: ['英国', 'UK'] },
        { name: '节点组-德国', match: ['德国', 'DE'] },
        { name: '节点组-加拿大', match: ['加拿大', 'CA'] },
        { name: '节点组-意大利', match: ['意大利', 'IT'] },
        { name: '节点组-俄罗斯', match: ['俄罗斯', 'RU'] },
        { name: '节点组-土耳其', match: ['土耳其', 'TR'] },
        { name: '节点组-印度', match: ['印度', 'IN'] },
        { name: '节点组-阿根廷', match: ['阿根廷', 'AR'] },
        { name: '节点组-越南', match: ['越南', 'VN'] },
        { name: '节点组-尼日利亚', match: ['尼日利亚', 'NG'] },
    ];

    const proxyNameCountries = []; // 存放所有生成的国家/地区组名称
    const proxyGroupCountriesFull = []; // 存放所有生成的国家/地区代理组（包含自动选择组）

    // 循环生成所有国家/地区代理组
    proxyMatcher.forEach(group => {
        // 使用原始节点名称列表来匹配，避免遗漏
        addProxyGroup(proxyGroupCountriesFull, proxyNameCountries, group.name, group.match, proxyNameRAW);
    });

    // 默认节点列表：包含自动选择、直连、负载均衡、所有国家组和所有原始节点
    const proxyNameCommon = ['默认代理', 'DIRECT', '负载均衡-轮询', '负载均衡-一致性哈希', ...proxyNameCountries, ...proxyNameRAW];

    // AI 专用节点列表：排除香港节点（香港节点对某些 AI 服务可能不友好）
    const proxyNameAIAuto = proxyNameAuto.filter(proxy => !proxy.includes('香港') && !proxy.includes('HK'));
    const proxyNameAI = ["自动选择-AI", ...proxyNameCountries, ...proxyNameRAW];

    // 分离出国家/地区的手动选择组和自动选择组
    const proxyGroupAuto = proxyGroupCountriesFull.filter(item => item.name && item.name.startsWith('自动选择'));
    const proxyGroupCountries = proxyGroupCountriesFull.filter(item => !item.name || !item.name.startsWith('自动选择'));

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
            name: 'OpenAI',
            icon: 'https://cdn.jsdelivr.net/gh/Huffer342-WSH/Clash-for-Windwos-parsers@main/icon/OpenAI.png',
            type: 'select',
            proxies: proxyNameAI
        },
        {
            name: 'Gemini',
            icon: 'https://cdn.jsdelivr.net/gh/Huffer342-WSH/Clash-for-Windwos-parsers@main/icon/Gemini.png',
            type: 'select',
            proxies: proxyNameAI
        },
        {
            name: 'Bing',
            icon: 'https://cdn.jsdelivr.net/gh/Huffer342-WSH/Clash-for-Windwos-parsers@main/icon/Bing.png',
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
    config['proxy-groups'] = [...proxyGroupStream, ...proxyGroupCountries, ...proxyGroupAuto];

    // ===================================
    // 规则集提供者（Rule Providers）
    // ===================================

    // 定义外部规则集，方便集中管理和更新
    config['rule-providers'] = {
        // 拒绝规则集
        'reject': {
            type: 'http',
            behavior: 'domain',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/reject.txt',
            path: './ruleset/reject.yaml',
            interval: rulesetUpdateInterval // 每天更新
        },
        // 直连规则集 (国内/常见)
        'direct': {
            type: 'http',
            behavior: 'domain',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/direct.txt',
            path: './ruleset/direct.yaml',
            interval: rulesetUpdateInterval
        },
        // 私有网络/内部 IP 规则集
        'private': {
            type: 'http',
            behavior: 'domain',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/private.txt',
            path: './ruleset/private.yaml',
            interval: rulesetUpdateInterval
        },
        // 国内 IP CIDR 规则集
        'cncidr': {
            type: 'http',
            behavior: 'ipcidr',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/cncidr.txt',
            path: './ruleset/cncidr.yaml',
            interval: rulesetUpdateInterval
        },
        // 代理规则集 (常用国外网站)
        'proxy': {
            type: 'http',
            behavior: 'domain',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/proxy.txt',
            path: './ruleset/proxy.yaml',
            interval: rulesetUpdateInterval
        },
        // GFW 列表规则集
        'gfw': {
            type: 'http',
            behavior: 'domain',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/gfw.txt',
            path: './ruleset/gfw.yaml',
            interval: rulesetUpdateInterval
        },
        // 苹果服务相关规则集
        'icloud': {
            type: 'http',
            behavior: 'domain',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/icloud.txt',
            path: './ruleset/icloud.yaml',
            interval: rulesetUpdateInterval
        },
        'apple': {
            type: 'http',
            behavior: 'domain',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/apple.txt',
            path: './ruleset/apple.yaml',
            interval: rulesetUpdateInterval
        },
        // Telegram IP CIDR 规则集
        'telegramcidr': {
            type: 'http',
            behavior: 'ipcidr',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/telegramcidr.txt',
            path: './ruleset/telegramcidr.yaml',
            interval: rulesetUpdateInterval
        },
        // 微软服务规则集
        'Microsoft': {
            type: 'http',
            behavior: 'classical',
            url: "https://cdn.jsdelivr.net/gh/zhanyeye/clash-rules-lite@release/microsoft-rules.txt",
            path: './ruleset/microsoft-rules.yaml',
            interval: rulesetUpdateInterval
        },
        // Gemini 服务规则集
        'Gemini': {
            type: 'http',
            behavior: 'classical',
            url: "https://cdn.jsdelivr.net/gh/Huffer342-WSH/Clash-for-Windwos-parsers@main/rules/Gemini.yaml",
            path: './ruleset/Gemini.yaml',
            interval: rulesetUpdateInterval
        },
        // OpenAI 服务规则集
        'OpenAI': {
            type: 'http',
            behavior: 'classical',
            url: "https://cdn.jsdelivr.net/gh/Huffer342-WSH/Clash-for-Windwos-parsers@main/rules/OpenAI.yaml",
            path: './ruleset/OpenAI.yaml',
            interval: rulesetUpdateInterval
        }
    };

    // ===================================
    // 规则列表（Rules）
    // ===================================
    const newRules = [
        // -----------------------------------
        // 0. 内部 IP 和局域网 (DIRECT) - 优先级最高
        // -----------------------------------
        'IP-CIDR,0.0.0.0/8,DIRECT,no-resolve',
        'IP-CIDR,10.0.0.0/8,DIRECT,no-resolve',
        'IP-CIDR,100.64.0.0/10,DIRECT,no-resolve',
        'IP-CIDR,127.0.0.0/8,DIRECT,no-resolve',
        'IP-CIDR,169.254.0.0/16,DIRECT,no-resolve',
        'IP-CIDR,172.16.0.0/12,DIRECT,no-resolve',
        'IP-CIDR,192.0.0.0/24,DIRECT,no-resolve',
        'IP-CIDR,192.0.2.0/24,DIRECT,no-resolve',
        'IP-CIDR,192.88.99.0/24,DIRECT,no-resolve',
        'IP-CIDR,192.168.0.0/16,DIRECT,no-resolve',
        'IP-CIDR,198.18.0.0/15,DIRECT,no-resolve', // Fake-IP Range
        'IP-CIDR,198.51.100.0/24,DIRECT,no-resolve',
        'IP-CIDR,203.0.113.0/24,DIRECT,no-resolve',
        'IP-CIDR,224.0.0.0/3,DIRECT,no-resolve',
        'IP-CIDR,::/127,DIRECT,no-resolve', // IPv6
        'IP-CIDR,fc00::/7,DIRECT,no-resolve', // IPv6
        'IP-CIDR,fe80::/10,DIRECT,no-resolve', // IPv6
        'IP-CIDR,ff00::/8,DIRECT,no-resolve', // IPv6

        // -----------------------------------
        // 1. 强制直连/代理规则（覆盖规则集）
        // -----------------------------------

        // Bing/Copilot 规则
        'DOMAIN-SUFFIX,cn.bing.com,DIRECT',      // 国内 Bing 直连
        'DOMAIN-SUFFIX,bing.com,Bing',           // 国际 Bing 走 Bing 代理组
        'DOMAIN-KEYWORD,copilot,Bing',           // Copilot 相关走 Bing 代理组
        'DOMAIN-SUFFIX,bingapis.com,Bing',
        'DOMAIN-SUFFIX,bingparachute.com,Bing',

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

        // 走代理的域名
        'DOMAIN,arthurchiao.art,默认代理',
        'DOMAIN,su.anywayfosec.xyz,默认代理',
        'DOMAIN,999.ts1110.top,默认代理',
        'DOMAIN,cdn.ramenpay.net,默认代理',
        'DOMAIN,cdn.xiaolincoding.com,默认代理',
        'DOMAIN,linuxmirrors.cn,默认代理',
        'DOMAIN-SUFFIX,taishan2025.icu,默认代理',
        'DOMAIN-SUFFIX,taishan.pro,默认代理',
        'DOMAIN-SUFFIX,haita.io,默认代理',
        'DOMAIN-SUFFIX,eehk.net,默认代理',
        'DOMAIN-SUFFIX,subxiandan.top,默认代理',
        'DOMAIN-SUFFIX,itzmx.com,默认代理',

        // 直连的域名
        'DOMAIN,download.pytorch.org,DIRECT',
        'DOMAIN,developer.download.nvidia.com,DIRECT',
        'DOMAIN-KEYWORD,starrycoding,DIRECT',
        'DOMAIN-KEYWORD,eriktse,DIRECT',
        'DOMAIN,oi-wiki.org,DIRECT',
        'DOMAIN,www.asasmr3.com,DIRECT',
        'DOMAIN,cdn2.asmrfx.com,DIRECT',
        'DOMAIN,tx.asmras.net,DIRECT',
        'DOMAIN,clash.razord.top,DIRECT', // Yacd 面板相关直连
        'DOMAIN,yacd.haishan.me,DIRECT', // Yacd 面板相关直连
        'DOMAIN-SUFFIX,entitlenow.com,DIRECT',
        'DOMAIN-KEYWORD,asasmr,DIRECT',

        // -----------------------------------
        // 2. 外部规则集调用（Rule-Set Providers）
        // -----------------------------------
        // 服务专用组规则
        'RULE-SET,apple,苹果服务',
        'RULE-SET,icloud,苹果服务',
        'RULE-SET,Microsoft,微软服务',
        'RULE-SET,telegramcidr,Telegram',
        'RULE-SET,Gemini,Gemini',
        'RULE-SET,OpenAI,OpenAI',

        // 通用代理
        'RULE-SET,proxy,默认代理',
        'RULE-SET,gfw,默认代理',

        'RULE-SET,reject,REJECT',        // 广告/恶意域名
        'RULE-SET,direct,DIRECT',        // 通用直连
        'RULE-SET,private,DIRECT',       // 私有网络直连
        'RULE-SET,cncidr,DIRECT',        // 国内 IP 直连
        'GEOIP,LAN,DIRECT', // 局域网 IP 直连
        'GEOIP,CN,DIRECT',  // 中国 IP 直连

        'MATCH,漏网之鱼' // 任何未匹配的流量都走 '漏网之鱼' 代理组
    ];

    config['rules'] = newRules;

    // 返回修改后的配置
    return config;
}
