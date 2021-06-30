开发中`Promise`是及其常用的语法，基本上对于异步的处理大都是通过`Promise`来进行完成。Promise规范有很多，ES6最终采用的时`Promise/A+ 规范`,所以以下代码也基本是基于这个规范来进行编写的。

首先我们先列举Promise的所有实例方法跟静态方法

**实例方法**

  * then: `new Promise((resolve, reject) => {...}).then(() => {console.log('rsolve成功回调')}, () => {console.log('reject失败回调')})`
  * catch: `new Promise((resolve, reject) => {...}).catch(() => {console.log('reject失败方法')})`
  * finally: `new Promise((resolve, reject) => {...}).finally(() => {console.log('成功失败都进入')})`
  * 以上方法调用都将返回新的`Promise`

**静态方法**

  * resolve: `Promise.resolve(value)`返回`Promise`实例
  * reject: `Promise.reject(value)`返回`Promise`实例
  * all: `Promise.all(promises)`: 传入数组格式的`Promise`并返回新的`Promise`实例，成功便按照顺序把值返回出来，其中一个失败则直接变成失败
  * race: `Promise.race(promises)`: 传入数组格式的`Promise`并返回新的`Promise`实例，成功与失败取决第一个的完成方式


`Promise`状态一旦确定变不可再发生变化，有以下三个状态：`pending`、`fulfilled`、`rejected`
`Promise`在浏览器中的实现是放于微任务队列中的，需要做微任务的处理（[`JavaScript中的Event Loop（事件循环）机制`](https://segmentfault.com/a/1190000022805523)）

## 1.声明Promise的实例方法

```javascript
class Promise {
  _value
  _state = 'pending'
  _queue = []
  constructor(fn) {
    if (typeof fn !== 'function') {
      throw 'Promise resolver undefined is not a function'
    }
    /* 
      new Promise((resolve, reject) => {
        resolve: 成功
        reject: 失败
      })
    */
    fn(this._resolve.bind(this), this._reject.bind(this))
  }

  // 接收1-2参数，第一个为成功的回调，第二个为失败的回调
  then(onFulfilled, onRejected) {
    // 有可能已经resolve了，因为Promise可以提前resolve,然后then方法后面注册
    if (this._state === 'fulfilled') {
      onFulfilled?.(this._value)
      return
    }
    // reject同理
    if (this._state === 'rejected') {
      onRejected?.(this._value)
      return
    }
    // Promise还没有完成，push到一个队列，到时候完成的时候，执行这个队列里面对应的函数
    this._queue.push({
      onFulfilled,
      onRejected,
    })
  }

  // 接收失败的回调
  catch(onRejected) {
    // 相当于直接调用then传入失败的回调
    this.then(null, onRejected)
  }

  // 成功与失败都执行的回调
  finally(onDone) {
    const fn = () => onDone()
    this.then(fn, fn)
  }
  // 成功resolve
  _resolve(value) {
    // 状态确定了，就不再发生变化了
    if (this._state !== 'pending') return
    this._state = 'fulfilled'

    // 把值存起来，当再次调用的时候直接取这个值就行，因为Promise一旦确定就不会发生改变了
    this._value = value

    // 执行前面.then方法里面push函数形式的参数，这样就执行对应的方法了。
    this._queue.forEach((callback) => {
      callback.onFulfilled?.(this._value)
    })
  }

  // 失败reject
  _reject(error) {
    // 状态确定了，就不再发生变化了
    if (this._state !== 'pending') return
    this._state = 'rejected'
    this._value = error
    this._queue.forEach((callback) => {
      callback.onRejected?.(this._value)
    })
  }
}
```

调用逻辑：

  1. 通过`then`方法传入函数形式的参数，也就是`onFulfilled` => `then((onFulfilled, onRejected) => {...})`

  2. 在`then`方法中把`onFulfilled`函数放入`_queue`这个集合中。 => `this._queue.push({ onFulfilled, onRejected })`

  3. 等异步回调完成，执行`resolve`函数，这个时候就调用`_queue`收集好的通过`then`方法注册的函数。统一执行这些函数，这样就达到异步回调完成，执行对应的`then`方法里面的函数


```javascript
// 结果打印
const p = new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve('success')
  }, 1000)
})
p.then((res) => {
  console.log(res) // => success
})

// reject
const p1 = new Promise((resolve, reject) => {
  setTimeout(() => {
    reject('fail')
  }, 1000)
})
p1.catch((res) => {
  console.log(res) // => fail
})

// finally
const p2 = new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve()
  }, 1000)
})
p2.finally(() => {
  console.log('done') // => done
})
```

> [在线代码演示](https://codesandbox.io/s/agitated-star-8w4cb?file=/Promise-step1.html)

## 2. 微任务处理以及返回Promise

### a. 进行微任务处理
在浏览器中 `Promise` 完成之后会被推入微任务，所以我们也需要进行这块的处理。浏览器中使用[MutationObserver](https://developer.mozilla.org/zh-CN/docs/Web/API/MutationObserver/MutationObserver),node可以使用`process.nextTick`

```javascript
class Promise {
  ...
  // 推入微任务
  _nextTick(fn) {
    if (typeof MutationObserver !== 'undefined') { // 浏览器通过MutationObserver实现微任务的效果
      // 这块可以单独拿出来共用，避免不必要的开销，不然每次都需要生成节点。
      const observer = new MutationObserver(fn)
      let count = 1
      const textNode = document.createTextNode(String(count))
      observer.observe(textNode, {
        characterData: true
      })
      textNode.data = String(++count)
    } else if (typeof process.nextTick !== 'undefined') { // node端通过process.nextTick来实现
      process.nextTick(fn)
    } else {
      setTimeout(fn, 0)
    }
  }
  // 成功resolve
  _resolve(value) {
    // 状态确定了，就不再发生变化了
    if (this._state !== 'pending') return
    // 推入微任务
    this._nextTick(() => {
      this._state = 'fulfilled'
      this._value = value
      this._queue.forEach((callback) => {
        callback.onFulfilled?.(this._value)
      })
    })
  }

  // 失败reject
  _reject(error) {
    // 状态确定了，就不再发生变化了
    if (this._state !== 'pending') return
    // 推入微任务
    this._nextTick(() => {
      this._state = 'rejected'
      this._value = error
      this._queue.forEach((callback) => {
        callback.onRejected?.(this._value)
      })
    })
  }
  ...
}
```
> [效果演示](https://codesandbox.io/s/agitated-star-8w4cb?file=/Promise-step2.html)

### b. 返回Promise进行链式调用
通常`Promise`会处理多个异步请求，有时候请求之间是有相互依赖关系的。

例如：

```javascript
const getUser = () => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve({
        userId: '123'
      })
    }, 500)
  })
}

const getDataByUser = (userId) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // ....
      resolve({a: 1})
    }, 500)
  })
}

// 使用
getUser().then((user) => {
  return getDataByUser(user.userId)
}).then((res) => {
  console.log(res)// {a: 1}
})
```

`getDataByUser`依赖`getUser`请求回来的用户信息，这里就需要用到`Promise`链式的调用,下面我们来改动我们的代码

```javascript
class Promise {
  constructor(fn) {
    fn(this._resolve.bind(this), this._reject.bind(this))
  }
  ...
  // 1. 这时候then方法需要返回新的Promise了,因为需要进行链式调用，并且下一个then方法接受上一个then方法的值
  // 2. 返回的Promise肯定是一个新的Promise，不然就会共用状态跟返回结果了。
  // 3. 把上一个then方法中的返回值当做下一个Promise resolve的值
  then(onFulfilled, onRejected) {
    // 返回新的Promise
    return new Promise((resolve, reject) => {
      // 有可能已经resolve了，因为Promise可以提前resolve,然后then方法后面注册,这个时候可以直接把值返给函数就好了
      if (this._state === 'fulfilled' && onFulfilled) {
        this._nextTick(onFulfilled.bind(this, this._value))
        return
      }
      if (this._state === 'rejected' && onRejected) {
        this._nextTick(onRejected.bind(this, this._value))
        return
      }
      /* 
        把当前Promise的then方法的参数跟新的Promise的resolve, reject存到一起，以此来做关联。
        这样就能把上一个Promise中的onFulfilled与新的Promise中的resolve两个关联到一块，然后便可以做赋值之类的操作了。reject同理
      */
      this._queue.push({
        onFulfilled,
        onRejected,
        resolve,
        reject
      })
    })
  }
  // reject同理
  _resolve(value) {
    // 状态确定了，就不再发生变化了
    if (this._state !== 'pending') return

    // 上面示例里面其实返回的是一个Promise,而不是直接返回的值，所以，这里我们需要做一个特殊处理。
    // 就是resolve()的值如果是Promise的对象，我们需要解析Promise的结果，然后在把值传给resolve
    if (typeof value === 'object' && typeof value.then === 'function') {
      // 我们可以把当前_resolve方法传递下去，因为then方法中的参数，一经下个Promise resolve,便会执行then方法对应的参数，然后把对应的值传入。
      // 这样就能取到Promise中的值
      // this._resove => obj.onFulfilled?.(this._value)
      // this._reject => obj.onRejected?.(this._value)
      value.then(this._resolve.bind(this), this._reject.bind(this))
      return
    }

    // 推入微任务
    this._nextTick(() => {
      this._state = 'fulfilled'
      this._value = value
      this._queue.forEach((obj) => {
        // 接受onFulfilled返回值
        const val = obj.onFulfilled?.(this._value)
        // reoslve这个值,此时 onFulfilled 是当前Promise then方法中的第一个参数： Promise.then((res) => {consolle.log(res)})
        // obj.resolve是新的Promise的resolve函数，这样就把then方法中的返回值传给下一个Promise
        obj.resolve(val)
      })
    })
  }
  ...
}

```
> [效果演示](https://codesandbox.io/s/agitated-star-8w4cb?file=/Promise-step3.html)



调用逻辑：

  1. 微任务采用`MutationObserver`跟`process.nextTick`来进行实现

  2. `Promise`链式调用，这里通过把`then`方法中的`(onFulfilled, onRejected)`参数与新返回的`Promise`中的`(resolve, reject)`关联到一起。

  3. 一旦上一个`Promise`成功,调用`onFulfilled`函数，就可以把`onFulfilled`中返回的值，放到新的Promise的resolve中。

  4. 如果遇到`resolve`的值是`Promise`对象，递归进行解析，然后再把值返回出去


完整代码

```javascript
class Promise {
  _value
  _state = 'pending'
  _queue = []
  constructor(fn) {
    if (typeof fn !== 'function') {
      throw new Error('Promise resolver undefined is not a function')
    }
    /* 
      new Promise((resolve, reject) => {
        resolve: 成功
        reject: 失败
      })
    */
    fn(this._resolve.bind(this), this._reject.bind(this))
  }

  // 接收1-2参数，第一个为成功的回调，第二个为失败的回调
  then(onFulfilled, onRejected) {
    // 返回新的Promise
    return new Promise((resolve, reject) => {
      // 有可能已经resolve了，因为Promise可以提前resolve,然后then方法后面注册,这个时候可以直接把值返给函数就好了
      if (this._state === 'fulfilled' && onFulfilled) {
        this._nextTick(onFulfilled.bind(this, this._value))
        return
      }
      if (this._state === 'rejected' && onRejected) {
        this._nextTick(onRejected.bind(this, this._value))
        return
      }
      // 把当前Promise的then方法的参数跟新的Promise的resolve, reject存到一起，以此来做关联
      this._queue.push({
        onFulfilled,
        onRejected,
        resolve,
        reject
      })
    })
  }

  // 接收失败的回调
  catch(onRejected) {
    return this.then(null, onRejected)
  }

  // 成功与失败都执行的回调
  finally(onDone) {
    return this.then((value) => {
      onDone()
      return value
    }, (value) => {
      // console.log(value)
      onDone()
      throw value
    })
  }

  // 推入微任务
  _nextTick(fn) {
    if (typeof MutationObserver !== 'undefined') { // 浏览器
      // 这块可以单独拿出来共用，避免不必要的开销，不然每次都需要生成节点。
      const observer = new MutationObserver(fn)
      let count = 1
      const textNode = document.createTextNode(String(count))
      observer.observe(textNode, {
        characterData: true
      })
      textNode.data = String(++count)
    } else if (typeof process.nextTick !== 'undefined') { // node
      process.nextTick(fn)
    } else {
      setTimeout(fn, 0)
    }
  }
  // 成功resolve
  _resolve(value) {
    // 状态确定了，就不再发生变化了
    if (this._state !== 'pending') return

    // 上面示例里面其实返回的时一个Promise,而不是直接返回的值，所以，这里我们需要做一个特殊处理。
    // 就是如果resolve()的如果是Promise的对象，我们需要解析Promise的结果，然后在把值传给resolve
    if (typeof value === 'object' && typeof value.then === 'function') {
      // 我们可以把当前_resolve方法传递下去，因为then方法中的参数，一经下个Promise resolve,便会执行then方法对应的参数，然后把对应的值传入。
      // 这样就能取到Promise中的值
      // this._resove => obj.onFulfilled?.(this._value)
      // this._reject => obj.onRejected?.(this._value)
      value.then(this._resolve.bind(this), this._reject.bind(this))
      return
    }

    // 推入微任务
    this._nextTick(() => {
      this._state = 'fulfilled'
      this._value = value
      this._queue.forEach((obj) => {
        // 使用try catch 来捕获onFulfilled存在函数内部错误的情况
        try {
          // 接受onFulfilled返回值，如果不存在，把this._value往下传递
          const val = obj.onFulfilled ? obj.onFulfilled(this._value) : this._value
          // reoslve这个值,此时 onFulfilled 是当前Promise then方法中的第一个参数： Promise.then((res) => {consolle.log(res)})
          // obj.resolve是新的Promise的resolve函数，这样就把then方法中的返回值传给下一个Promise
          obj.resolve(val)
        } catch (e) {
          obj.reject(e)
        }
      })
    })
  }

  // 失败reject
  _reject(error) {
    if (this._state !== 'pending') return
    this._nextTick(() => {
      this._state = 'rejected'
      this._value = error
      this._queue.forEach((obj) => {
        try {
          const val = obj.onRejected ? obj.onRejected(this._value) : this._value
          // 当前 reject执行完毕之后，会返回新的Promise，应该是能正常resolve的，所以这里要用 resolve, 不应该继续使用reject来让下个Promise执行失败流程
          obj.resolve(val)
        } catch (e) {
          obj.reject(e)
        }
      })
    })
  }
}
```

## 声明Promise的静态方法
总共有4个静态方法: `Promise.resolve`、`Promise.reject`、`Promise.all`、`Promise.race`，统一返回的都是新的Promise。

```javascript
class Promise {
  ...
  /**
   * 直接resolve
   */
  static resolve(value) {
    // 是Promise直接返回
    if (value instanceof Promise) {
      return value
    } else if (typeof value === 'object' && typeof value.then === 'function') {
      // 传入的对象含有then方法
      const then = value.then
      return new Promise((resolve) => {
        then.call(value, resolve)
      })
    } else {
      // 正常返回值，直接返回新的Promise在resolve这个值
      return new Promise((resolve) => resolve(value))
    }
  }

  /**
   * 直接reject, 测试下Promise.reject并没做特殊处理，所以直接返回即可。
   */
  static reject(value) {
    return new Promise((resolve, reject) => reject(value))
  }

  /**
   * 传入数组格式的`Promise`并返回新的`Promise`实例，成功便按照顺序把值返回出来，其中一个失败则直接变成失败
   */
  static all(promises) {
    return new Promise((resolve, reject) => {
      let count = 0
      let arr = []
      // 按照对应的下标push到数组里面
      promises.forEach((promise, index) => {
        // 转换成Promise对象
        Promise.resolve(promise).then((res) => {
          count++
          arr[index] = res
          if (count === promises.length) {
            resolve(arr)
          }
        }, err => reject(err))
      })
    })
  }
  
  /**
   * 传入数组格式的`Promise`并返回新的`Promise`实例，成功与失败取决第一个的完成方式
   */
  static race(promises) {
    return new Promise((resolve, reject) => {
      promises.forEach((promise, index) => {
        // 转换成Promise对象
        Promise.resolve(promise).then((res) => {
          // 谁先执行直接resolve, 或reject
          resolve(res)
        }, err => reject(err))
      })
    })
  }
  ...
}
```

## Promise实现完整代码

```javascript
class Promise {
  _value
  _state = 'pending'
  _queue = []
  constructor(fn) {
    if (typeof fn !== 'function') {
      throw new Error('Promise resolver undefined is not a function')
    }
    /* 
      new Promise((resolve, reject) => {
        resolve: 成功
        reject: 失败
      })
    */
    fn(this._resolve.bind(this), this._reject.bind(this))
  }

  /**
   * 接收1-2参数，第一个为成功的回调，第二个为失败的回调
   *
   * @param {*} onFulfilled
   * @param {*} onRejected
   * @return {*} 
   * @memberof Promise
   */
  then(onFulfilled, onRejected) {
    // 返回新的Promise
    return new Promise((resolve, reject) => {
      // 有可能已经resolve了，因为Promise可以提前resolve,然后then方法后面注册,这个时候可以直接把值返给函数就好了
      if (this._state === 'fulfilled' && onFulfilled) {
        this._nextTick(onFulfilled.bind(this, this._value))
        return
      }
      if (this._state === 'rejected' && onRejected) {
        this._nextTick(onRejected.bind(this, this._value))
        return
      }
      // 把当前Promise的then方法的参数跟新的Promise的resolve, reject存到一起，以此来做关联
      this._queue.push({
        onFulfilled,
        onRejected,
        resolve,
        reject
      })
    })
  }

  /**
   * 接收失败的回调
   *
   * @param {*} onRejected
   * @return {*} 
   * @memberof Promise
   */
  catch(onRejected) {
    return this.then(null, onRejected)
  }

  /**
   * 成功与失败都执行的回调
   *
   * @param {*} onDone
   * @return {*} 
   * @memberof Promise
   */
  finally(onDone) {
    return this.then((value) => {
      onDone()
      return value
    }, (value) => {
      onDone()
      // 直接报错，可以在try catch中捕获错误
      throw value
    })
  }

  /**
   * 直接resolve
   *
   * @static
   * @param {*} value
   * @return {*} 
   * @memberof Promise
   */
  static resolve(value) {
    if (value instanceof Promise) {
      return value
    } else if (typeof value === 'object' && typeof value.then === 'function') {
      // 传入的对象含有then方法
      const then = value.then
      return new Promise((resolve) => {
        then.call(value, resolve)
      })
    } else {
      return new Promise((resolve) => resolve(value))
    }
  }

  /**
   * 直接reject, 测试下reject在Promise.reject中没做特殊处理
   *
   * @static
   * @param {*} value
   * @return {*} 
   * @memberof Promise
   */
  static reject(value) {
    return new Promise((resolve, reject) => reject(value))
  }

  /**
   * 传入数组格式的`Promise`并返回新的`Promise`实例，成功便按照顺序把值返回出来，其中一个失败则直接变成失败
   *
   * @static
   * @param {*} promises
   * @memberof Promise
   */
  static all(promises) {
    return new Promise((resolve, reject) => {
      let count = 0
      let arr = []
      if (Array.isArray(promises)) {
        if (promises.length === 0) {
          return resolve(promises)
        }
        promises.forEach((promise, index) => {
          // 转换成Promise对象
          Promise.resolve(promise).then((res) => {
            count++
            arr[index] = res
            if (count === promises.length) {
              resolve(arr)
            }
          }, err => reject(err))
        })
        return
      } else {
        reject(`${promises} is not Array`)
      }
    })
  }
  
  /**
   * 传入数组格式的`Promise`并返回新的`Promise`实例，成功与失败取决第一个的完成方式
   *
   * @static
   * @param {*} promises
   * @return {*} 
   * @memberof Promise
   */
  static race(promises) {
    return new Promise((resolve, reject) => {
      if (Array.isArray(promises)) {
        promises.forEach((promise, index) => {
          // 转换成Promise对象
          Promise.resolve(promise).then((res) => {
            resolve(res)
          }, err => reject(err))
        })
      } else {
        reject(`${promises} is not Array`)
      }
    })
  }

  // 推入微任务
  _nextTick(fn) {
    if (typeof MutationObserver !== 'undefined') { // 浏览器
      // 这块可以单独拿出来共用，避免不必要的开销，不然每次都需要生成节点。
      const observer = new MutationObserver(fn)
      let count = 1
      const textNode = document.createTextNode(String(count))
      observer.observe(textNode, {
        characterData: true
      })
      textNode.data = String(++count)
    } else if (typeof process.nextTick !== 'undefined') { // node
      process.nextTick(fn)
    } else {
      setTimeout(fn, 0)
    }
  }
  // 成功resolve
  _resolve(value) {
    // 状态确定了，就不再发生变化了
    if (this._state !== 'pending') return

    // 上面示例里面其实返回的时一个Promise,而不是直接返回的值，所以，这里我们需要做一个特殊处理。
    // 就是如果resolve()的如果是Promise的对象，我们需要解析Promise的结果，然后在把值传给resolve
    if (typeof value === 'object' && typeof value.then === 'function') {
      // 我们可以把当前_resolve方法传递下去，因为then方法中的参数，一经下个Promise resolve,便会执行then方法对应的参数，然后把对应的值传入。
      // 这样就能取到Promise中的值
      // this._resove => obj.onFulfilled?.(this._value)
      // this._reject => obj.onRejected?.(this._value)
      value.then(this._resolve.bind(this), this._reject.bind(this))
      return
    }

    // 通过打印测试，如果直接在线程里进行resolve, 状态跟值好像是直接就改变了，并没有执行完主流程，在执行微任务的时候进行修改的。
    // 所以把状态改变和值的修改移出了微任务，只有在走回调的时候才通过微任务进行处理
    this._state = 'fulfilled'
    this._value = value

    // 推入微任务
    this._nextTick(() => {
      this._queue.forEach((obj) => {
        // 使用try catch 来捕获onFulfilled存在函数内部错误的情况
        try {
          // 接受onFulfilled返回值，如果不存在，把this._value往下传递
          const val = obj.onFulfilled ? obj.onFulfilled(this._value) : this._value
          // reoslve这个值,此时 onFulfilled 是当前Promise then方法中的第一个参数： Promise.then((res) => {consolle.log(res)})
          // obj.resolve是新的Promise的resolve函数，这样就把then方法中的返回值传给下一个Promise
          obj.resolve(val)
        } catch (e) {
          obj.reject(e)
        }
      })
    })
  }

  // 失败reject
  _reject(error) {
    if (this._state !== 'pending') return
    this._state = 'rejected'
    this._value = error

    this._nextTick(() => {
      this._queue.forEach((obj) => {
        try {
          // 用户传入的函数内部错误捕获
          if (obj.onRejected) {
            const val = obj.onRejected(this._value)
            // 当前 reject执行完毕之后，会返回新的Promise，应该是能正常resolve的，所以这里要用 resolve, 不应该继续使用reject来让下个Promise执行失败流程
            obj.resolve(val)
          } else {
            // 递归传递reject错误
            obj.reject(this._value)
          }
        } catch (e) {
          obj.reject(e)
        }
      })
    })
  }
}
```

> [完整演示效果](https://codesandbox.io/s/agitated-star-8w4cb?file=/complete.html)

以上就是Promise的实现方案,当然这个跟完整的`Promises/A+规范`是有区别的。这里只是用做于学习之用。
