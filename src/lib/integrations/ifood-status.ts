import https from "https"

export function updateIfoodStatus(
  token: string,
  merchantId: string,
  orderId: string,
  status: string
): Promise<{ success: boolean; status?: number; body?: string }> {
  return new Promise((resolve) => {
    const body = JSON.stringify({ code: status })
    const options = {
      hostname: "merchant-api.ifood.com.br",
      path: `/order/v1.0/orders/${orderId}/status`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        MerchantId: merchantId,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    }

    const req = https.request(options, (res) => {
      let b = ""
      res.on("data", (c) => (b += c))
      res.on("end", () => {
        resolve({
          success: res.statusCode === 200 || res.statusCode === 204,
          status: res.statusCode,
          body: b
        })
      })
    })
    req.on("error", (e) => resolve({ success: false, body: e.message }))
    req.write(body)
    req.end()
  })
}
