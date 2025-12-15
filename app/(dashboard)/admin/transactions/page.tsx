'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { getTransactions, getUsers } from '@/actions/admin'
import { formatBalance } from '@/types/pricing'
import type { Transaction } from '@/types/transaction'
import type { User } from '@/types/user'

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [filterUserId, setFilterUserId] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')

  useEffect(() => {
    const loadData = async () => {
      const [transData, userData] = await Promise.all([
        getTransactions(),
        getUsers()
      ])
      setTransactions(transData)
      setUsers(userData)
      setLoading(false)
    }
    loadData()
  }, [])

  const loadFiltered = async () => {
    setLoading(true)
    const filter: Record<string, string> = {}
    if (filterUserId) filter.userId = filterUserId
    if (filterType) filter.type = filterType
    const data = await getTransactions(filter as any)
    setTransactions(data)
    setLoading(false)
  }

  useEffect(() => {
    if (!loading) {
      loadFiltered()
    }
  }, [filterUserId, filterType])

  const getUserName = (userId: string) => {
    const user = users.find(u => u._id.toString() === userId)
    return user?.username || userId
  }

  if (loading && users.length === 0) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">交易记录</h1>
        <p className="text-muted-foreground">查看所有充值和消费记录</p>
      </div>

      <div className="flex gap-4">
        <Select value={filterUserId} onValueChange={setFilterUserId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="全部用户" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">全部用户</SelectItem>
            {users.map(user => (
              <SelectItem key={user._id.toString()} value={user._id.toString()}>
                {user.username}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="全部类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">全部类型</SelectItem>
            <SelectItem value="recharge">充值</SelectItem>
            <SelectItem value="consume">消费</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>记录列表</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="space-y-2">
              {transactions.map((trans) => (
                <div key={trans._id.toString()} className="flex items-center justify-between p-3 border rounded text-sm">
                  <div className="flex items-center gap-4">
                    <span className="font-medium w-24">{getUserName(trans.userId.toString())}</span>
                    <span className={`w-20 ${trans.type === 'recharge' ? 'text-green-600' : 'text-red-600'}`}>
                      {trans.type === 'recharge' ? '+' : ''}{formatBalance(trans.amount)}
                    </span>
                    <span className="text-muted-foreground">{trans.description}</span>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {new Date(trans.createdAt).toLocaleString('zh-CN')}
                  </span>
                </div>
              ))}
              {transactions.length === 0 && (
                <div className="text-center text-muted-foreground py-8">暂无记录</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
