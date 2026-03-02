let orderCounter = 0;
let tradeCounter = 0;

function randomDigits(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
}

export function generateOrderId(): string {
  orderCounter++;
  const timestamp = Date.now().toString().slice(-10);
  const counter = orderCounter.toString().padStart(5, '0');
  return timestamp + counter;
}

export function generateExchangeOrderId(): string {
  return randomDigits(15);
}

export function generateTradeId(): string {
  tradeCounter++;
  const timestamp = Date.now().toString().slice(-5);
  const counter = tradeCounter.toString().padStart(3, '0');
  return timestamp + counter;
}

export function generateGuid(): string {
  return `${randomDigits(8)}${randomDigits(4)}${randomDigits(4)}${randomDigits(4)}${randomDigits(12)}`;
}

export function generateUuid(): string {
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  const seg = (n: number) => Array.from({ length: n }, hex).join('');
  return `${seg(8)}-${seg(4)}-${seg(4)}-${seg(4)}-${seg(12)}`;
}

export function resetCounters(): void {
  orderCounter = 0;
  tradeCounter = 0;
}
