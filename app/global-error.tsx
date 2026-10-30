"use client";
import FailurePanel from "./FailurePanel";
export default function GlobalError({retry}: {error: unknown; retry: () => void}) {
  return <html lang="en"><body style={{margin:0}}><FailurePanel retry={retry}/></body></html>;
}
