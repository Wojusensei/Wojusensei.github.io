---
cover: /images/uuz.jpg
title: 纯文档PR？我到底做了什么
description: 本文将较为详细地讲述本人在鼓起勇气向 CPython 官方解释器仓库做第一次贡献时的踩坑经历。
date: 2026-09-07
tags: [随笔,开发]
---

# 何处开始？

看过博客的`贡献`板块之后，你会发现那里居然安静地躺着一份我对[CPython](https://github.com/python/cpython)的PR。这份拉取请求**完全没有涉及到python的内核**，看起来就是一个平平无奇的文档PR，仅仅只是对说明文档做了五行改动：删掉三行，添加两行，和修改错别字的贡献坐一桌。是的，这份贡献的含金量可以说相当低下。

那我为什么还要贴出来~~装X~~呢？

## 由来？

在一开始，我其实在处理另一份 issue 。那份议题提出的问题是：XML plist 文件里的 key 标签出现在 dict 容器外部时，解析器没有给出有意义的错误提示，而是直接抛出一个让用户摸不着头脑的 IndexError 。

拿一段不合法的 plist 文件来举例：

```xml
<plist version="1.0">
<key>foo</key>
<string>bar</string>
</plist>
```

在这里，key 直接放在根部，外面没有 dict 包裹。解析器在执行 end_key() 方法时，self.stack 是空的，但代码没有检查这一点就直接访问了 self.stack[-1]，触发了 IndexError 。

我的理解是：解决这个问题的最优方案是在 Lib/plistlib.py 的 _PlistParser 类中，给 end_key() 方法加一个空栈检查——这样之后，遇到不合法的 plist 文件会抛出带行号的 InvalidFileException，而不是让用户看到莫名其妙的 IndexError 。对此我做了如下修改：
```python
def end_key(self):
    if not self.stack:
        raise InvalidFileException("'key' element found outside of a 'dict' at line %d" %
                                   self.parser.CurrentLineNumber)
    # 此处是原有逻辑
```
在对此模块进行修改之后，我提交了我对 Cpython 仓库的第一个 PR：不幸的是，这个PR撞车了——有人在我之前提交了一个改动。对方在 end_key() 里同样加了空栈检查，但使用的是 ValueError，有别于我使用的 InvalidFileException（plistlib 专有的异常类）

**根据先来后到的规则，我的PR被close了。**

不过，实际上我认为在这个问题中 InvalidFileException 的使用要优于 ValueError ：InvalidFileException 是 plistlib 自己定义的异常，继承自 ValueError。用它的好处是调用者可以精确捕获“plist 文件格式错误”，而不需要捕获所有 ValueError。在一致性上，我提供的方案在模块内模块内的表现是其他解析错误都用 InvalidFileException ，且对于可能出现的错误信息提供了包含行号的报错，显然，对于用户更加友好。当然，这些都是后话了，我相信肯定会有更加厉害也更加热心的贡献者会提出我所想象不到的更优秀的方法来优化这个问题；于我而言，这个被关闭的拉取请求或许可以成为别人的参考，这就够了——当然我也有后悔的事情，就像那句话："It wastes the maintainer's time to close the duplicate PR ."

## 后续？
毕竟贡献时间处于一个假期，我也处于游手好闲的阶段，于是在PR被拒之后，我开始在 Cpython 的 issue 列表里面闲逛。偶然间，我看到了 Issue #152798 ："sys.thread_info.lock was changed to 'pymutex' in 3.15, even though _thread.Lock had already switched to PyMutex in 3.14 and 3.13.1"。也就是说，报告者发现了两个不一致：在 Python 3.13.1 / 3.14 和 Python 3.15 中，_thread.Lock 底层实现均是已改用了 PyMutex 的；而在后者的 sys.thread_info.lock 返回值已经修改的情况下，前者的返回值仍是"semaphore"（Linux）或 None（Windows）。

报告者提出这个改动滞后了—— 根据 ta 的意思，_thread.Lock 早在 3.13.1 / 3.14 就已经切到 PyMutex，但 sys.thread_info.lock 直到 3.15 才改；PyMutex 本身底层仍然依赖平台相关的同步原语（POSIX semaphore、pthread_cond + pthread_mutex、Windows CreateSemaphore），所以返回 "pymutex" 反而让它的含义变得模糊，建议把 sys.thread_info.lock 改回原来的值。

乍一看这个 issue 讲的很有道理，但是仔细琢磨一下感觉确实是 nonesense（此处用“确实是”，因为在该 issue 开放期间，我有一位群友对其发表了这样的评价）：在后面看来， sys.thread_info.lock 返回的字符串不是用来“精确描述底层实现”的，而是给用户一个方便调试的粗略标签。它的值不需要随着实现细节的变化而实时更新——尤其是当实现变化发生在补丁版本（3.13.1）时，改一个用户可见的字符串会造成不必要的扰动。

但是鉴于此 issue 已经给出了明确的实现方案，这个改动并无难度，而且我还未删除 fork 的仓库，于是在两三分钟内完成了这个改动并提交 PR 。

PR 在调试之后正常通过了 CI 审核，但是这个看起来 nonsense 的 issue 和我这个直接按照该 issue 实现修改的方案引发了一些来自仓库维护者的讨论。

[Vstinner](https://github.com/vstinner)提出：
- *"Python 3.13 has been released in October 2024. IMO it's now too late to change it."*
- *"If something is done, it should be to only enhance the documentation."*
- *"I prefer the short string 'pymutex' to refer to PyMutex."*

是的，3.13 已经发了，现在改代码太晚——根据他的意思，"pymutex" 是合适的名字，要修改也应该只限于说明文档。

另一位参与者 GalaxySnail 同意了“too late”的判断，但他仍主张 在 3.15 里 revert，恢复到旧值 ：
- *"100% agree. That's why I proposed to revert this change in 3.15."*

然而 Vstinner 明确反对 revert："That's not what I'm saying. I don't suggest a revert."

自然的，兼容性是第一原则：一旦 sys.thread_info.lock 在 3.15 正式发布并返回 "pymutex"，它就成了稳定 API。可能有用户已经基于这个值写了脚本或测试：再改回旧值，就是破坏兼容性。Vstinner 还说，*"sys.thread_info is mostly here to help debugging CPython issues. I don't see why someone would really bother how locks are implemented in Python."*：这个字段是给开发者调试用的，而不是给普通用户做业务逻辑的。既然没人依赖它，也就不需要修正它。

于是，最终被合并的 #153263 只修改了一个文件：Doc/library/sys.rst，而且是只改了 thread_info.lock 那一小段文档。具体修改如下：
```rst
.. attribute:: thread_info.lock

   The name of the lock implementation:

   * ``"semaphore"``: a lock uses a semaphore (Python 3.14 and older)
   * ``"mutex+cond"``: a lock uses a mutex and a condition variable (Python 3.14 and older)
   * ``"pymutex"``: a lock uses the :c:type:`PyMutex` implementation (Python 3.15 and newer)
   * ``None`` if this information is unknown
```
对，只是让文档和代码实际行为保持同步而已。最后我也收到了 PR 被 merge 的通知——虽然那个时候我还在为第一份 PR 撞车而惋惜，因为那一份才是我花了大精力进行修改的成果。



