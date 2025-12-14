import { xhsRequest } from '../client'

export interface AccountInfo {
  userId: string
  advertiserId: string
  nickname: string
  avatar?: string
  balance: number
  todaySpent: number
  cookieValid: boolean
}

/**
 * 获取账号信息
 *
 * TODO: 根据抓包数据实现
 * 预期返回：用户ID、广告主ID、余额等信息
 */
export async function getAccountInfo(params: {
  cookie: string
}): Promise<AccountInfo> {
  // TODO: 替换为实际接口
  // const data = await xhsRequest({
  //   cookie: params.cookie,
  //   path: '/api/gw/advertiser/account/info',
  // })
  //
  // return {
  //   userId: data.userId,
  //   advertiserId: data.advertiserId,
  //   nickname: data.nickname,
  //   avatar: data.avatar,
  //   balance: data.balance / 100, // 分转元
  //   todaySpent: data.todaySpent / 100,
  //   cookieValid: true,
  // }

  throw new Error('getAccountInfo: 接口待实现，请提供抓包数据')
}

/**
 * 获取广告主 ID
 *
 * TODO: 根据抓包数据实现
 */
export async function getAdvertiserId(params: {
  cookie: string
}): Promise<string> {
  const info = await getAccountInfo(params)
  return info.advertiserId
}

/**
 * 获取账户余额
 *
 * TODO: 根据抓包数据实现
 */
export async function getAccountBalance(params: {
  cookie: string
  advertiserId: string
}): Promise<number> {
  // TODO: 替换为实际接口
  // const data = await xhsRequest({
  //   cookie: params.cookie,
  //   path: `/api/gw/advertiser/${params.advertiserId}/balance`,
  // })
  //
  // return data.balance / 100 // 分转元

  throw new Error('getAccountBalance: 接口待实现，请提供抓包数据')
}
