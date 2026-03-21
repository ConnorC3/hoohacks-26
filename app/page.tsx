"use client"

import dynamic from "next/dynamic"

const StockGraph = dynamic(() => import("@/components/graph/StockGraph"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
      Initialising…
    </div>
  ),
})

export default function Home() {
  return (
    <main className="flex flex-col flex-1 h-full">
      <StockGraph />
    </main>
  )
}
