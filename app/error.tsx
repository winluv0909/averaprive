"use client";
import FailurePanel from "./FailurePanel";
export default function ErrorPage({retry}: {error: unknown; retry: () => void}) { return <FailurePanel retry={retry}/>; }
