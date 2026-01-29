/**
 * Callback URL 白名单验证测试脚本
 *
 * 运行方式：
 * npx ts-node apps/auth-center/src/lib/test-callback-validator.ts
 */

import { validateCallbackUrl, getAllowedDomainsList } from './callback-validator'

console.log('🧪 开始测试 Callback URL 白名单验证...\n')

// 测试用例
const testCases = [
  // ✅ 合法 URL
  {
    url: 'https://pr.crazyaigc.com/auth-callback',
    shouldPass: true,
    description: 'PR 业务系统（HTTPS）',
  },
  {
    url: 'https://www.crazyaigc.com/callback',
    shouldPass: true,
    description: '主站点（HTTPS）',
  },
  {
    url: 'https://os.crazyaigc.com/complete',
    shouldPass: true,
    description: '账号中心自身（HTTPS）',
  },
  {
    url: 'https://3xvs5r4nm4.coze.site/auth/callback',
    shouldPass: true,
    description: 'Coze Bot（HTTPS）',
  },
  {
    url: 'http://localhost:3000/auth/callback',
    shouldPass: true,
    description: '本地开发环境（HTTP + localhost）',
  },

  // ❌ 非法 URL
  {
    url: 'https://evil.com/callback',
    shouldPass: false,
    description: '未知域名（应该被拒绝）',
  },
  {
    url: 'https://fake-pr.crazyaigc.com.evil.com/callback',
    shouldPass: false,
    description: '伪装域名（应该被拒绝）',
  },
  {
    url: 'http://pr.crazyaigc.com/callback',
    shouldPass: false,
    description: '非 localhost 但使用 HTTP（应该被拒绝）',
  },
  {
    url: 'not-a-url',
    shouldPass: false,
    description: '无效 URL 格式（应该被拒绝）',
  },
]

// 运行测试
let passedTests = 0
let failedTests = 0

console.log('📋 当前白名单配置:')
console.log(getAllowedDomainsList())
console.log('\n' + '='.repeat(80) + '\n')

testCases.forEach((testCase, index) => {
  const result = validateCallbackUrl(testCase.url)
  const passed = result === testCase.shouldPass

  if (passed) {
    passedTests++
    console.log(`✅ 测试 ${index + 1}: 通过`)
  } else {
    failedTests++
    console.log(`❌ 测试 ${index + 1}: 失败`)
  }

  console.log(`   描述: ${testCase.description}`)
  console.log(`   URL: ${testCase.url}`)
  console.log(`   预期: ${testCase.shouldPass ? '✅ 通过' : '❌ 拒绝'}`)
  console.log(`   实际: ${result ? '✅ 通过' : '❌ 拒绝'}`)
  console.log('')
})

// 输出测试结果
console.log('='.repeat(80))
console.log('\n📊 测试结果汇总:')
console.log(`   总计: ${testCases.length}`)
console.log(`   ✅ 通过: ${passedTests}`)
console.log(`   ❌ 失败: ${failedTests}`)
console.log(`   通过率: ${((passedTests / testCases.length) * 100).toFixed(1)}%\n`)

if (failedTests === 0) {
  console.log('🎉 所有测试通过！白名单验证功能正常工作。\n')
  process.exit(0)
} else {
  console.log('⚠️  部分测试失败，请检查配置。\n')
  process.exit(1)
}
