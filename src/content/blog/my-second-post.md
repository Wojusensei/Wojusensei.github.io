---
cover: /images/uuz.jpg
title: 纯文档PR？我到底经历了什么
description: 本文将较为详细地讲述本人在鼓起勇气向 CPython 官方解释器仓库做第一次贡献的踩坑经历
date: 2026-09-07
tags: [随笔,开发]
---

# 何处开始？

看过博客的`贡献`板块之后，你会发现那里居然安静地躺着一份我对[CPython](https://github.com/python/cpython)的PR。这份拉取请求**完全没有涉及到python的内核**，看起来就是一个平平无奇的文档PR，仅仅只是对说明文档做了五行改动：删掉三行，添加两行，和修改错别字的贡献坐一桌。是的，这份贡献的含金量可以说相当低下。

那我为什么还要贴出来~~装X~~呢？

## 由来？

在一开始，我其实在处理另一份 issue 。那份议题提出的问题是：XML plist 文件里的 key 标签出现在 dict 容器外部时，解析器没有给出有意义的错误提示，而是直接抛出一个让用户摸不着头脑的 IndexError 。这是怎么回事呢？

拿一段不合法的 plist 文件来举例：

```xml
<plist version="1.0">
<key>foo</key>
<string>bar</string>
</plist>
```

在这里，key 直接放在根部，外面没有 dict 包裹。解析器在执行 end_key() 方法时，self.stack 是空的，但代码没有检查这一点就直接访问了 self.stack[-1]，触发了 IndexError 。

我的理解是：要解决这个问题的最优方案是在 Lib/plistlib.py 的 _PlistParser 类中，给 end_key() 方法加一个空栈检查——这样之后，遇到不合法的 plist 文件会抛出带行号的 InvalidFileException，而不是让用户看到莫名其妙的 IndexError 。对此我做了如下修改：
```python
def end_key(self):
    if not self.stack:
        raise InvalidFileException("'key' element found outside of a 'dict' at line %d" %
                                   self.parser.CurrentLineNumber)
    # 此处是原有逻辑
```
在对此模块进行修改之后，我提交了我对 Cpython 仓库的第一个 PR：不幸的是，这个PR撞车了——有人在我之前提交了一个改动。对方在 end_key() 里同样加了空栈检查，但使用的是 ValueError，有别于我使用的 InvalidFileException（plistlib 专有的异常类）

**根据规则，我的PR被close了。**

不过，实际上我认为在这个问题中 InvalidFileException 的使用要优于 ValueError ：InvalidFileException 是 plistlib 自己定义的异常，继承自 ValueError。用它的好处是调用者可以精确捕获“plist 文件格式错误”，而不需要捕获所有 ValueError。在一致性上，我提供的方案在模块内模块内的表现是其他解析错误都用 InvalidFileException ，且对于可能出现的错误信息提供了包含行号的报错，显然对于用户更加友好。当然，这些都是后话了，肯定会有更加厉害也更加热心的贡献者会提出我所想象不到的更优秀的方法来优化这个问题；于我而言，这个被关闭的拉取请求或许可以成为别人的参考，这就够了——当然我也有后悔的事情，就像那句话："It wastes the maintainer's time to close the duplicate PR ."

## 后续？
- 正在更新中，请稍后

