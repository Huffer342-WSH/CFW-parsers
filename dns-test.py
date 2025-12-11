import tkinter as tk
from tkinter import ttk, messagebox
import dns.message
import dns.query
import dns.rdatatype
import dns.flags
import time
import threading
import ssl
import socket
import urllib.request
import urllib.error
from typing import List, Dict, Any

# --- 配置 ---
# 定义服务器列表，包含类型、名称和地址
DNS_SERVERS = [
    # ==========================================
    # 1. UDP Servers (标准传统 DNS, Port 53)
    # ==========================================
    {"type": "UDP", "name": "Google", "addr": "8.8.8.8"},
    {"type": "UDP", "name": "Google Sec", "addr": "8.8.4.4"},  # Google 备用
    {"type": "UDP", "name": "Cloudflare", "addr": "1.1.1.1"},
    {"type": "UDP", "name": "Quad9", "addr": "9.9.9.9"},
    {"type": "UDP", "name": "AliDNS (阿里)", "addr": "223.5.5.5"},
    {"type": "UDP", "name": "DNSPod (腾讯)", "addr": "119.29.29.29"},
    {"type": "UDP", "name": "OpenDNS", "addr": "208.67.222.222"},
    {"type": "UDP", "name": "DNS.SB", "addr": "185.222.222.222"}, # 对应下面的 DoH

    # ==========================================
    # 2. DoT Servers (DNS over TLS, Port 853)
    #    注意：addr 仅需填写 IP，代码会自动使用 TLS 连接 853 端口
    # ==========================================
    {"type": "DoT", "name": "Google DoT", "addr": "8.8.8.8"},
    {"type": "DoT", "name": "Google DoT Sec", "addr": "8.8.4.4"},
    {"type": "DoT", "name": "Cloudflare DoT", "addr": "1.1.1.1"},
    {"type": "DoT", "name": "Quad9 DoT", "addr": "9.9.9.9"},
    {"type": "DoT", "name": "AliDNS DoT", "addr": "223.5.5.5"},
    {"type": "DoT", "name": "DNSPod DoT", "addr": "1.12.12.12"}, # 腾讯 DoT 通常用这个 IP

    # ==========================================
    # 3. DoH Servers (DNS over HTTPS, Port 443)
    # ==========================================
    # --- 国内常用 ---
    {"type": "DoH", "name": "AliDNS DoH", "addr": "https://dns.alidns.com/dns-query"},
    {"type": "DoH", "name": "DNSPod DoH (腾讯)", "addr": "https://doh.pub/dns-query"},

    # --- 国际/港台 ---
    {"type": "DoH", "name": "TWNIC DoH (台湾)", "addr": "https://dns.twnic.tw/dns-query"},
    {"type": "DoH", "name": "Google DoH", "addr": "https://dns.google/dns-query"},
    {"type": "DoH", "name": "Cloudflare DoH", "addr": "https://cloudflare-dns.com/dns-query"},
    {"type": "DoH", "name": "Quad9 DoH", "addr": "https://dns11.quad9.net/dns-query"},
    {"type": "DoH", "name": "DNS.SB DoH", "addr": "https://doh.dns.sb/dns-query"},
]

TIMEOUT: float = 1.0

class DNSTesterApp:
    def __init__(self, master):
        self.master = master
        master.title("DNS测试")
        master.geometry("800x600")

        # --- 变量 ---
        self.target_url = tk.StringVar(value="www.google.com")
        self.is_running = False

        # --- 初始化 GUI ---
        self._setup_widgets()

    def _setup_widgets(self):
        main_frame = ttk.Frame(self.master, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)

        # 1. 输入区域
        input_frame = ttk.LabelFrame(main_frame, text="查询设置", padding="10")
        input_frame.pack(fill=tk.X, pady=5)

        ttk.Label(input_frame, text="测试域名 (A记录):").pack(side=tk.LEFT, padx=5)
        self.url_entry = ttk.Entry(input_frame, textvariable=self.target_url, width=30)
        self.url_entry.pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)

        self.query_button = ttk.Button(input_frame, text="开始测试", command=self.start_query_thread)
        self.query_button.pack(side=tk.LEFT, padx=10)

        # 2. 状态区域
        self.status_label = ttk.Label(main_frame, text="状态: 准备就绪", foreground="blue")
        self.status_label.pack(anchor=tk.W, pady=5)

        # 3. 结果列表
        columns = ("type", "name", "addr", "result", "latency")
        self.tree = ttk.Treeview(main_frame, columns=columns, show="headings")

        self.tree.heading("type", text="类型")
        self.tree.heading("name", text="服务商")
        self.tree.heading("addr", text="服务器地址")
        self.tree.heading("result", text="解析结果 IP")
        self.tree.heading("latency", text="延迟 (ms)")

        self.tree.column("type", width=60, anchor="center")
        self.tree.column("name", width=120, anchor="w")
        self.tree.column("addr", width=200, anchor="w")
        self.tree.column("result", width=150, anchor="w")
        self.tree.column("latency", width=80, anchor="e")

        self.tree.pack(fill=tk.BOTH, expand=True, side=tk.LEFT)

        vsb = ttk.Scrollbar(main_frame, orient="vertical", command=self.tree.yview)
        vsb.pack(fill=tk.Y, side=tk.RIGHT)
        self.tree.configure(yscrollcommand=vsb.set)

        self._populate_initial_servers()

    def _populate_initial_servers(self):
        self.tree.delete(*self.tree.get_children())
        for server in DNS_SERVERS:
            self.tree.insert("", "end", values=(
                server["type"], server["name"], server["addr"], "等待...", "---"
            ))

    def start_query_thread(self):
        if self.is_running:
            return

        hostname = self.target_url.get().strip()
        if not hostname:
            messagebox.showerror("错误", "请输入要查询的域名")
            return

        self.is_running = True
        self.query_button.config(state=tk.DISABLED, text="测试中...")
        self.status_label.config(text=f"正在测试域名: {hostname} ...")
        self._populate_initial_servers()

        thread = threading.Thread(target=self._run_tests, args=(hostname,))
        thread.daemon = True # 设置为守护线程，主程序关闭时自动结束
        thread.start()

    def _run_tests(self, hostname):
        results = []

        # 逐个跑并实时更新UI
        children = self.tree.get_children()

        for index, server in enumerate(DNS_SERVERS):
            item_id = children[index]

            # 更新当前行为 "查询中"
            self.master.after(0, self.tree.set, item_id, "result", "查询中...")

            # 执行查询
            ip_res, latency = self._perform_dns_query(server, hostname)

            # 整理结果
            res_data = {
                "id": item_id,
                "ip": ip_res,
                "latency": latency,
                "success": latency > 0
            }

            # 更新 UI
            self.master.after(0, self._update_row, res_data)

        self.master.after(0, self._finalize)

    def _perform_dns_query(self, server_info, hostname):
        """核心逻辑：根据不同类型分发查询"""
        qname = hostname
        stype = server_info["type"]
        addr = server_info["addr"]

        # 构建 DNS 查询消息 (A记录)
        try:
            request = dns.message.make_query(qname, dns.rdatatype.A)
        except Exception:
             return "Invalid Hostname", -1

        latency = -1
        result_ip = "Error"

        try:
            start_time = time.perf_counter()
            response = None

            if stype == "UDP":
                # 标准 UDP 查询
                response = dns.query.udp(request, addr, timeout=TIMEOUT)

            elif stype == "DoT":
                # DNS over TLS (Port 853)
                # 注意：有些DoT服务器需要Server Name Indication (SNI)，通常直接用IP连接即可，
                # 但为了严谨，标准做法可能需要验证主机名。这里为了宽容度，我们仅做连接。
                # context = ssl.create_default_context()
                # context.check_hostname = False
                # context.verify_mode = ssl.CERT_NONE
                # dns.query.tls 默认会尝试验证，如果失败可能会抛错。
                # 简化起见，我们直接传 IP。
                response = dns.query.tls(request, addr, timeout=TIMEOUT)

            elif stype == "DoH":
                # DNS over HTTPS
                # 我们使用 urllib 实现，避免引入 requests 库
                response = self._query_doh_urllib(request, addr)

            end_time = time.perf_counter()
            latency = (end_time - start_time) * 1000

            # 解析结果中的 IP
            if response and response.answer:
                # 提取 A 记录
                ips = []
                for rrset in response.answer:
                    if rrset.rdtype == dns.rdatatype.A:
                        for rr in rrset:
                            ips.append(rr.to_text())
                if ips:
                    result_ip = ips[0] + (f" (+{len(ips)-1})" if len(ips) > 1 else "")
                else:
                    result_ip = "No A Record"
            else:
                result_ip = "No Answer"

        except dns.exception.Timeout:
            result_ip = "Timeout"
        except urllib.error.URLError as e:
            result_ip = f"HTTP Error: {e.reason}"
        except Exception as e:
            # 截断错误信息防止过长
            err_msg = str(e)
            if "certificate verify failed" in err_msg:
                result_ip = "SSL Cert Error"
            else:
                result_ip = f"Err: {err_msg[:15]}..."

        return result_ip, latency

    def _query_doh_urllib(self, request_msg, url):
        """
        使用标准库 urllib 发送 DoH 请求 (POST wire format)。
        这样不需要 pip install requests。
        """
        wire_data = request_msg.to_wire()
        headers = {
            "Content-Type": "application/dns-message",
            "Accept": "application/dns-message"
        }

        req = urllib.request.Request(url, data=wire_data, headers=headers, method="POST")

        with urllib.request.urlopen(req, timeout=TIMEOUT) as f:
            response_data = f.read()
            return dns.message.from_wire(response_data)

    def _update_row(self, data):
        item_id = data["id"]
        latency_str = f"{data['latency']:.1f} ms" if data['latency'] > 0 else "---"

        self.tree.set(item_id, "result", data["ip"])
        self.tree.set(item_id, "latency", latency_str)

        # 简单着色
        tags = ("success",) if data["success"] else ("failure",)
        self.tree.item(item_id, tags=tags)

        # 定义样式
        self.tree.tag_configure('success', foreground='green')
        self.tree.tag_configure('failure', foreground='red')

    def _finalize(self):
        self.is_running = False
        self.query_button.config(state=tk.NORMAL, text="开始测试")
        self.status_label.config(text="测试完成。")

if __name__ == "__main__":
    try:
        root = tk.Tk()
        app = DNSTesterApp(root)
        root.mainloop()
    except ImportError:
        # Fallback without GUI loop if something is critical
        print("Error: dnspython is missing. Run 'pip install dnspython'")
    except Exception as e:
        print(f"Error: {e}")
