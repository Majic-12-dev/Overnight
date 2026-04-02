import { useCallback, useState } from 'react'
import type { ToolDefinition } from '@/data/toolRegistry'
import { BaseToolLayout } from '@/components/tools/BaseToolLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Copy, CheckCircle, Network, XCircle } from 'lucide-react'

type ToolProps = {
  tool: ToolDefinition
}

type SubnetResult = {
  ipAddress: string
  subnetMask: string
  cidr: string
  networkAddress: string
  broadcastAddress: string
  wildcardMask: string
  gatewayAddress: string
  firstHost: string
  lastHost: string
  hostCount: number
  ipClass: string
  ipType: string
}

/**
 * Validate an IPv4 address
 */
function isValidIPv4(ip: string): boolean {
  const parts = ip.trim().split('.')
  if (parts.length !== 4) return false
  return parts.every((p) => {
    if (!/^\d+$/.test(p)) return false
    const num = parseInt(p, 10)
    return num >= 0 && num <= 255 && p === num.toString()
  })
}

/**
 * Validate CIDR prefix length
 */
function isValidCidr(cidr: number): boolean {
  return Number.isInteger(cidr) && cidr >= 0 && cidr <= 32
}

/**
 * Convert CIDR to subnet mask string (e.g. 24 -> "255.255.255.0")
 */
function cidrToMask(cidr: number): string {
  const mask = cidr === 0 ? 0 : (0xffffffff << (32 - cidr)) >>> 0
  return ipToString(mask)
}

/**
 * Convert IP string to 32-bit unsigned integer
 */
function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0
}

/**
 * Convert 32-bit unsigned integer to IP string
 */
function ipToString(num: number): string {
  return [
    (num >>> 24) & 0xff,
    (num >>> 16) & 0xff,
    (num >>> 8) & 0xff,
    num & 0xff,
  ].join('.')
}

function getClass(ip: string): string {
  const first = parseInt(ip.split('.')[0], 10)
  if (first >= 1 && first <= 126) return 'A'
  if (first >= 128 && first <= 191) return 'B'
  if (first >= 192 && first <= 223) return 'C'
  if (first >= 224 && first <= 239) return 'D (Multicast)'
  if (first >= 240 && first <= 255) return 'E (Reserved)'
  return 'Unknown'
}

function getType(ip: string): string {
  return ip.startsWith('10.') ||
    ip.startsWith('172.') &&
    (() => {
      const second = parseInt(ip.split('.')[1], 10)
      return second >= 16 && second <= 31
    })() ||
    ip.startsWith('192.168.')
    ? 'Private'
    : ip.startsWith('127.')
      ? 'Loopback'
      : ip.startsWith('169.254.')
        ? 'Link-Local'
        : 'Public'
}

function computeSubnet(ip: string, cidr: number): SubnetResult {
  const ipInt = ipToInt(ip)
  const maskInt = cidr === 0 ? 0 : (0xffffffff << (32 - cidr)) >>> 0
  const networkInt = (ipInt & maskInt) >>> 0
  const wildcardInt = (~maskInt) >>> 0
  const broadcastInt = (networkInt | wildcardInt) >>> 0

  const hostCount = cidr >= 31 ? (cidr === 32 ? 1 : 2) : Math.max(0, 2 ** (32 - cidr) - 2)
  const firstHost = cidr >= 31 ? ipToString(networkInt) : ipToString(networkInt + 1)
  const lastHost = cidr >= 32 ? ipToString(broadcastInt) : ipToString(broadcastInt - 1)
  const gatewayInt = (networkInt + 1) >>> 0

  return {
    ipAddress: ip,
    subnetMask: cidrToMask(cidr),
    cidr: `${ip}/${cidr}`,
    networkAddress: ipToString(networkInt),
    broadcastAddress: ipToString(broadcastInt),
    wildcardMask: ipToString(wildcardInt),
    gatewayAddress: ipToString(gatewayInt),
    firstHost,
    lastHost,
    hostCount,
    ipClass: getClass(ip),
    ipType: getType(ip),
  }
}

function CopyableItem({ label, value }: { label: string; value: string | number }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(String(value)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [value])

  return (
    <div className='flex items-center justify-between py-2 border-b border-border last:border-b-0'>
      <span className='text-sm text-muted'>{label}</span>
      <div className='flex items-center gap-2'>
        <code className='text-sm font-mono text-text'>{value}</code>
        <Button variant='ghost' className='h-6 w-6 flex-shrink-0' onClick={handleCopy}>
          {copied ? (
            <CheckCircle className='h-3 w-3 text-green-400' />
          ) : (
            <Copy className='h-3 w-3' />
          )}
        </Button>
      </div>
    </div>
  )
}

export function SubnetCalculatorTool({ tool }: ToolProps) {
  const [ip, setIp] = useState('')
  const [cidr, setCidr] = useState(24)
  const [result, setResult] = useState<SubnetResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCalculate = useCallback(() => {
    setError(null)
    setResult(null)

    const trimmed = ip.trim()
    if (!isValidIPv4(trimmed)) {
      setError('Invalid IPv4 address. Please enter a valid address like 192.168.1.1')
      return
    }

    if (!isValidCidr(cidr)) {
      setError('CIDR prefix must be an integer between 0 and 32.')
      return
    }

    setResult(computeSubnet(trimmed, cidr))
  }, [ip, cidr])

  const handleCopyAll = useCallback(() => {
    if (!result) return
    const lines = [
      `Network: ${result.networkAddress}/${result.cidr.split('/')[1]}`,
      `Subnet Mask: ${result.subnetMask}`,
      `Broadcast: ${result.broadcastAddress}`,
      `Gateway: ${result.gatewayAddress}`,
      `Host Range: ${result.firstHost} - ${result.lastHost}`,
      `Total Hosts: ${result.hostCount}`,
    ]
    navigator.clipboard.writeText(lines.join('\n')).then(() => {})
  }, [result])

  return (
    <BaseToolLayout
      title={tool.name}
      description={tool.description}
      options={
        <div className='space-y-4 text-sm'>
          {/* IP Input */}
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>IP Address</div>
            <input
              type='text'
              placeholder='192.168.1.0'
              value={ip}
              onChange={(e) => {
                setIp(e.target.value)
                setError(null)
              }}
              className='w-full rounded-xl border border-border bg-base/70 px-3 py-2 text-sm font-mono text-text placeholder:text-muted/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent'
            />
          </div>

          {/* CIDR Input */}
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>
              CIDR Prefix (/{cidr})
            </div>
            <input
              type='range'
              min={0}
              max={32}
              value={cidr}
              onChange={(e) => setCidr(parseInt(e.target.value, 10))}
              className='w-full accent-accent'
            />
            <div className='flex items-center gap-2'>
              <Button
                variant='ghost'
                className='h-8 w-8 rounded-lg text-xs'
                onClick={() => setCidr(Math.max(0, cidr - 1))}
              >
                −
              </Button>
              <input
                type='number'
                min={0}
                max={32}
                value={cidr}
                onChange={(e) => setCidr(Math.max(0, Math.min(32, parseInt(e.target.value) || 0)))}
                className='h-10 w-full rounded-xl border border-border bg-base/70 px-3 text-center text-sm font-mono text-text focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent'
              />
              <Button
                variant='ghost'
                className='h-8 w-8 rounded-lg text-xs'
                onClick={() => setCidr(Math.min(32, cidr + 1))}
              >
                +
              </Button>
            </div>
          </div>

          {/* Quick CIDR presets */}
          <div className='space-y-2'>
            <div className='text-xs font-semibold uppercase text-muted'>Presets</div>
            <div className='grid grid-cols-2 gap-1.5'>
              {[
                { label: '/24', val: 24 },
                { label: '/16', val: 16 },
                { label: '/8', val: 8 },
                { label: '/30', val: 30 },
                { label: '/32', val: 32 },
                { label: '/25', val: 25 },
              ].map((p) => (
                <button
                  key={p.val}
                  type='button'
                  onClick={() => setCidr(p.val)}
                  className={`rounded-lg border px-2 py-1.5 text-center text-xs font-mono transition
                    ${cidr === p.val ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-base/60 text-muted hover:text-text'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <Badge className='border-0 bg-accent/15 text-accent'>Offline • Client-side only</Badge>

          <Button onClick={handleCalculate} className='w-full'>
            <Network className='mr-2 h-4 w-4' />
            Calculate
          </Button>
        </div>
      }
    >
      <div className='space-y-4'>
        {/* Error */}
        {error && (
          <Card className='flex items-start gap-3 border border-red-500/50 bg-red-500/10'>
            <XCircle className='mt-0.5 h-5 w-5 flex-shrink-0 text-red-400' />
            <div className='text-sm text-red-200'>{error}</div>
          </Card>
        )}

        {/* Results */}
        {result && (
          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2 text-sm font-semibold text-accent'>
                <Network className='h-4 w-4' />
                Subnet Details
              </div>
              <Button variant='ghost' className='h-7 text-[10px]' onClick={handleCopyAll}>
                <Copy className='mr-1 h-3 w-3' />
                Copy All
              </Button>
            </div>

            <Card className='divide-y divide-border'>
              <CopyableItem label='CIDR Notation' value={result.cidr} />
              <CopyableItem label='Subnet Mask' value={result.subnetMask} />
              <CopyableItem label='Network Address' value={result.networkAddress} />
              <CopyableItem label='Broadcast Address' value={result.broadcastAddress} />
              <CopyableItem label='Wildcard Mask' value={result.wildcardMask} />
              <CopyableItem label='Gateway' value={result.gatewayAddress} />
              <CopyableItem label='First Host' value={result.firstHost} />
              <CopyableItem label='Last Host' value={result.lastHost} />
              <CopyableItem label='Total Usable Hosts' value={result.hostCount.toLocaleString()} />
              <CopyableItem label='IP Class' value={result.ipClass} />
              <CopyableItem label='IP Type' value={result.ipType} />
            </Card>
          </div>
        )}

        {!result && !error && (
          <Card className='rounded-xl border border-border bg-base/60 px-4 py-6 text-center text-sm text-muted'>
            <div className='flex justify-center mb-2'>
              <Network className='h-6 w-6 text-accent' />
            </div>
            <p>Enter an IPv4 address and CIDR prefix to calculate network details.</p>
          </Card>
        )}
      </div>
    </BaseToolLayout>
  )
}
