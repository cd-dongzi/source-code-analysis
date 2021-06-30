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
