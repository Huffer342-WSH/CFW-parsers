module.exports.parse = async (raw, { axios, yaml, notify, console }, { name, url, interval, selected }) => {
    const obj = yaml.parse(raw)
    //////////////////////   DNS  //////////////////////
    obj.dns["default-nameserver"].splice(0, 1, "223.5.5.5")
    obj.dns["default-nameserver"].splice(1, 1, "119.29.29.29")

    obj.dns["nameserver"].splice(0, 1, "https://doh.pub/dns-query")
    obj.dns["nameserver"].splice(1, 1, "https://dns.alidns.com/dns-query")

    obj.dns["fallback"].splice(0, 1, "https://1.1.1.1/dns-query")
    obj.dns["fallback"].splice(1, 1, "https://208.67.222.222/dns-query")

    const fallback_filter = {
        geoip: true,
        "geoip-code": 'CN',
        ipcidr: ['240.0.0.0/4', '0.0.0.0/32']
    };
    obj.dns["fallback-filter"] = fallback_filter

    //////////////////////   Proxy Group  //////////////////////

    //默认代理
    const defProxies = obj.proxies.filter(proxy => !proxy.name.includes('剩余') && !proxy.name.includes('套餐'));
    const defAProxyGroup = {
        name: '默认代理-自动选择',
        type: 'url-test',
        proxies: defProxies.map(proxy => proxy.name),
        url: 'http://www.gstatic.com/generate_204',
        interval: 86400
    };
    obj['proxy-groups'].push(defAProxyGroup);
    const defProxyGroup = {
        name: '默认代理',
        type: 'select',
        proxies: defProxies.map(proxy => proxy.name)
    };
    defProxyGroup.proxies.splice(0, 0, '默认代理-自动选择');
    obj['proxy-groups'].splice(0, 0, defProxyGroup);

    const chatgpt = {
        name: 'chatgpt',
        type: 'select',
        proxies: ['美国', '台湾', '新加坡', '日本']
    };
    obj['proxy-groups'].splice(1, 0, chatgpt);

    const bing = {
        name: 'bing',
        type: 'select',
        proxies: ['美国', 'DIRECT', '香港', '台湾', '新加坡']
    };
    obj['proxy-groups'].splice(2, 0, bing);

    const battle = {
        name: '战网',
        type: 'select',
        proxies: ['美国', 'DIRECT', '香港', '台湾', '新加坡']
    };
    obj['proxy-groups'].splice(2, 0, battle);

    const Apple = {
        name: '苹果服务',
        type: 'select',
        proxies: ['美国', 'DIRECT', '香港', '台湾', '新加坡']
    };
    obj['proxy-groups'].splice(3, 0, Apple);

    const Microsoft = {
        name: '微软服务',
        type: 'select',
        proxies: ['美国', 'DIRECT', '香港', '台湾', '新加坡']
    };
    obj['proxy-groups'].splice(3, 0, Microsoft);

    const match = {
        name: '漏网之鱼',
        type: 'select',
        proxies: ['默认代理', '美国', '香港', '日本', '台湾', '新加坡', 'DIRECT']
    };
    obj['proxy-groups'].splice(3, 0, match);

    //美国
    const usProxies = obj.proxies.filter(proxy => proxy.name.includes('美国'));
    if (usProxies.length > 0) {
        const usProxyGroup = {
            name: '美国',
            type: 'select',
            proxies: usProxies.map(proxy => proxy.name)
        };
        usProxyGroup.proxies.push('美国-自动选择')
        obj['proxy-groups'].push(usProxyGroup);
        const us_AutoProxyGroup = {
            name: '美国-自动选择',
            type: 'url-test',
            proxies: usProxies.map(proxy => proxy.name),
            url: 'http://www.gstatic.com/generate_204',
            interval: 86400
        };
        obj['proxy-groups'].push(us_AutoProxyGroup);
    } else {
        const usProxyGroup = {
            name: '美国',
            type: 'select',
            proxies: ['DIRECT']
        };
        obj['proxy-groups'].push(usProxyGroup);
    }

    // 香港
    const hkProxies = obj.proxies.filter(proxy => proxy.name.includes('香港'));
    if (hkProxies.length > 0) {
        const hkProxyGroup = {
            name: '香港',
            type: 'select',
            proxies: hkProxies.map(proxy => proxy.name)
        };
        hkProxyGroup.proxies.push('香港-自动选择');
        obj['proxy-groups'].push(hkProxyGroup);

        const hk_AutoProxyGroup = {
            name: '香港-自动选择',
            type: 'url-test',
            proxies: hkProxies.map(proxy => proxy.name),
            url: 'http://www.gstatic.com/generate_204',
            interval: 86400
        };
        obj['proxy-groups'].push(hk_AutoProxyGroup);
    } else {
        const hkProxyGroup = {
            name: '香港',
            type: 'select',
            proxies: ['DIRECT']
        };
        obj['proxy-groups'].push(hkProxyGroup);
    }

    // 台湾
    const twProxies = obj.proxies.filter(proxy => proxy.name.includes('台湾'));
    if (twProxies.length > 0) {
        const twProxyGroup = {
            name: '台湾',
            type: 'select',
            proxies: twProxies.map(proxy => proxy.name)
        };
        twProxyGroup.proxies.push('台湾-自动选择');
        obj['proxy-groups'].push(twProxyGroup);

        const tw_AutoProxyGroup = {
            name: '台湾-自动选择',
            type: 'url-test',
            proxies: twProxies.map(proxy => proxy.name),
            url: 'http://www.gstatic.com/generate_204',
            interval: 86400
        };
        obj['proxy-groups'].push(tw_AutoProxyGroup);
    } else {
        const twProxyGroup = {
            name: '台湾',
            type: 'select',
            proxies: ['DIRECT']
        };
        obj['proxy-groups'].push(twProxyGroup);
    }

    // 日本
    const jpProxies = obj.proxies.filter(proxy => proxy.name.includes('日本'));
    if (jpProxies.length > 0) {
        const jpProxyGroup = {
            name: '日本',
            type: 'select',
            proxies: jpProxies.map(proxy => proxy.name)
        };
        jpProxyGroup.proxies.push('日本-自动选择');
        obj['proxy-groups'].push(jpProxyGroup);

        const jp_AutoProxyGroup = {
            name: '日本-自动选择',
            type: 'url-test',
            proxies: jpProxies.map(proxy => proxy.name),
            url: 'http://www.gstatic.com/generate_204',
            interval: 86400
        };
        obj['proxy-groups'].push(jp_AutoProxyGroup);
    } else {
        const jpProxyGroup = {
            name: '日本',
            type: 'select',
            proxies: ['DIRECT']
        };
        obj['proxy-groups'].push(jpProxyGroup);
    }

    // 新加坡
    const sgProxies = obj.proxies.filter(proxy => proxy.name.includes('新加坡'));
    if (sgProxies.length > 0) {
        const sgProxyGroup = {
            name: '新加坡',
            type: 'select',
            proxies: sgProxies.map(proxy => proxy.name)
        };
        sgProxyGroup.proxies.push('新加坡-自动选择');
        obj['proxy-groups'].push(sgProxyGroup);

        const sg_AutoProxyGroup = {
            name: '新加坡-自动选择',
            type: 'url-test',
            proxies: sgProxies.map(proxy => proxy.name),
            url: 'http://www.gstatic.com/generate_204',
            interval: 86400
        };
        obj['proxy-groups'].push(sg_AutoProxyGroup);
    } else {
        const sgProxyGroup = {
            name: '新加坡',
            type: 'select',
            proxies: ['DIRECT']
        };
        obj['proxy-groups'].push(sgProxyGroup);
    }

    // 俄罗斯
    const ruProxies = obj.proxies.filter(proxy => proxy.name.includes('俄罗斯'));
    if (ruProxies.length > 0) {
        const ruProxyGroup = {
            name: '俄罗斯',
            type: 'select',
            proxies: ruProxies.map(proxy => proxy.name)
        };
        ruProxyGroup.proxies.push('俄罗斯-自动选择');
        obj['proxy-groups'].push(ruProxyGroup);

        const ru_AutoProxyGroup = {
            name: '俄罗斯-自动选择',
            type: 'url-test',
            proxies: ruProxies.map(proxy => proxy.name),
            url: 'http://www.gstatic.com/generate_204',
            interval: 86400
        };
        obj['proxy-groups'].push(ru_AutoProxyGroup);
    } else {
        const ruProxyGroup = {
            name: '俄罗斯',
            type: 'select',
            proxies: ['DIRECT']
        };
        obj['proxy-groups'].push(ruProxyGroup);
    }

    //////////////////////   Rule Providers  //////////////////////
    const newRuleProviders = {
        'reject': {
            type: 'http',
            behavior: 'domain',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/reject.txt',
            path: './ruleset/reject.yaml',
            interval: 86400
        },
        'icloud': {
            type: 'http',
            behavior: 'domain',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/icloud.txt',
            path: './ruleset/icloud.yaml',
            interval: 86400
        },
        'apple': {
            type: 'http',
            behavior: 'domain',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/apple.txt',
            path: './ruleset/apple.yaml',
            interval: 86400
        },
        'google': {
            type: 'http',
            behavior: 'domain',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/google.txt',
            path: './ruleset/google.yaml',
            interval: 86400
        },
        'proxy': {
            type: 'http',
            behavior: 'domain',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/proxy.txt',
            path: './ruleset/proxy.yaml',
            interval: 86400
        },
        'direct': {
            type: 'http',
            behavior: 'domain',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/direct.txt',
            path: './ruleset/direct.yaml',
            interval: 86400
        },
        'private': {
            type: 'http',
            behavior: 'domain',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/private.txt',
            path: './ruleset/private.yaml',
            interval: 86400
        },
        'gfw': {
            type: 'http',
            behavior: 'domain',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/gfw.txt',
            path: './ruleset/gfw.yaml',
            interval: 86400
        },
        'tld-not-cn': {
            type: 'http',
            behavior: 'domain',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/tld-not-cn.txt',
            path: './ruleset/tld-not-cn.yaml',
            interval: 86400
        },
        'telegramcidr': {
            type: 'http',
            behavior: 'ipcidr',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/telegramcidr.txt',
            path: './ruleset/telegramcidr.yaml',
            interval: 86400
        },
        'cncidr': {
            type: 'http',
            behavior: 'ipcidr',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/cncidr.txt',
            path: './ruleset/cncidr.yaml',
            interval: 86400
        },
        'lancidr': {
            type: 'http',
            behavior: 'ipcidr',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/lancidr.txt',
            path: './ruleset/lancidr.yaml',
            interval: 86400
        },
        'applications': {
            type: 'http',
            behavior: 'classical',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/applications.txt',
            path: './ruleset/applications.yaml',
            interval: 86400
        },
        'Microsoft': {
            type: 'http',
            behavior: 'classical',
            url: "https://cdn.jsdelivr.net/gh/zhanyeye/clash-rules-lite@release/microsoft-rules.txt",
            path: './providers/rule-microsoft.yaml',
            interval: 86400
        }
    };

    obj['rule-providers'] = obj['rule-providers'] || {};
    Object.assign(obj['rule-providers'], newRuleProviders);


    //////////////////////  rules  //////////////////////
    const newRules = [
        //Matlab
        'PROCESS-NAME,MathWorksProductInstaller.exe,DIRECT',
        'PROCESS-NAME,MATLABWindow.exe,DIRECT',
        'DOMAIN-SUFFIX,mathworks.com,默认代理',

        //IEEE
        'DOMAIN,www.freertos.org,默认代理',
        'DOMAIN,katex.org,默认代理',
        'DOMAIN,ieeexplore.ieee.org,默认代理',
        'DOMAIN,jichangtuijian.com,默认代理',
        'DOMAIN,plotly.com,默认代理',

        //steam
        'DOMAIN,api.steampowered.com,默认代理',
        'PROCESS-NAME,steamwebhelper.exe,默认代理',
        'PROCESS-NAME,steam.exe,DIRECT',

        //starrycoding
        'DOMAIN-KEYWORD,starrycoding,DIRECT',
        'DOMAIN-KEYWORD,eriktse,DIRECT',
        'DOMAIN,oi-wiki.org,DIRECT',
        'DOMAIN,download.epicgames.com,DIRECT',
        'DOMAIN,fastly-download.epicgames.com,DIRECT',
        //chatgpt
        'DOMAIN-SUFFIX,chatgpt.com,chatgpt',
        'DOMAIN-SUFFIX,openai.com,chatgpt',
        'DOMAIN,cdn.oaistatic.com,chatgpt',
        'DOMAIN,ccdn.auth0.com,chatgpt',
        'DOMAIN,s.gravatar.com,chatgpt',
        'DOMAIN-KEYWORD,gemini,chatgpt',
        'DOMAIN-KEYWORD,claude,chatgpt',
        'DOMAIN,plausible.midway.run,chatgpt',
        'DOMAIN-SUFFIX,bing.com,bing',
        'DOMAIN-KEYWORD,copilot,bing',
        'DOMAIN-SUFFIX,bingapis.com,bing',
        'PROCESS-NAME,Battle.net.exe,战网',
        'DOMAIN,telemetry-in.battle.net,战网',
        'DOMAIN-SUFFIX,bingparachute.com,bing',
        'DOMAIN-SUFFIX,itzmx.com,默认代理',
        'DOMAIN-SUFFIX,epicgames.com,默认代理',
        'PROCESS-NAME,qbittorrent.exe,默认代理',
        'PROCESS-NAME,fdm.exe,默认代理',
        'DOMAIN-SUFFIX,pythonhosted.org,默认代理',
        'DOMAIN-SUFFIX,codeium.com,默认代理',
        'DOMAIN-SUFFIX,hp.com,默认代理',

        'DOMAIN-SUFFIX,acg.rip,默认代理',
        'DOMAIN-SUFFIX,sublimetext.com,默认代理',
        'DOMAIN-SUFFIX,zmyos.com,默认代理',

        'DOMAIN,www.asasmr3.com,DIRECT',
        'DOMAIN,cdn2.asmrfx.com,DIRECT',
        'DOMAIN,tx.asmras.net,DIRECT',
        'DOMAIN-KEYWORD,asasmr,DIRECT',
        'DOMAIN,clash.razord.top,DIRECT',
        'DOMAIN,yacd.haishan.me,DIRECT',
        // 'RULE-SET,applications,DIRECT',
        'RULE-SET,private,DIRECT',
        'RULE-SET,direct,DIRECT',
        'RULE-SET,reject,REJECT',
        'RULE-SET,apple,苹果服务',
        'RULE-SET,Microsoft,微软服务',
        'RULE-SET,tld-not-cn,默认代理',
        'RULE-SET,gfw,默认代理',
        'RULE-SET,telegramcidr,默认代理',
        'GEOIP,CN,DIRECT',
        'MATCH,漏网之鱼'
    ];
    obj['rules'] = newRules;
    // obj['rules'] = obj['rules'] || [];
    // obj['rules'].unshift(...newRules);

    return yaml.stringify(obj)
}
