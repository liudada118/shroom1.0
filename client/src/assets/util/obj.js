const sizeNum = 2
export default class beel {
    /**
     * Sarr数组添加arr周围一周的点
     * */
    AddArr(Sarr, arr) {
        for (let j = -sizeNum; j <= sizeNum; j++) {
            for (let k = -sizeNum; k <= sizeNum; k++) {
                Sarr.push([arr[0] + j, arr[1] + k])
            }
        }
        return Sarr
    }

    /**
     * 二维数组去重
    */
    set(arr) {
        let BArr = arr.map((a, index) => JSON.stringify(a))
        let vs = new Set(BArr)
        let b = Array.from(vs)
        return b.map((a, index) => JSON.parse(a))
    }

    /**
     * 新建的圆中寻找原始数据中的相交的点
     * aArr 新建的圆数组   bArr原始数据
     * 返回值为 相交的点  和这些点在原始数据中的索引
    */
    findSame(aArr, bArr) {
        let arr = [], arrnum = []
        for (let i = 0; i < bArr.length; i++) {
            // b 新数组与原数组的交集
            let b = aArr.filter((a, index) => {
                return JSON.stringify(a) == JSON.stringify(bArr[i])
            })
            if (b.length > 0) {
                arrnum.push(i)
            }
            arr.push(...b)
        }
        // console.log(arrnum)
        return arrnum
    }

    /**
     * 有原始数据组成的真实的圆
     * BFA 为原始数据 ，sfaArr为有添加点的圆
    */

    findReal(BFA, sfaArr) {
        let bfa = BFA.map((a, index) => {
            return JSON.stringify(a)
        })
        let SArr = []
        for (let i = 0; i < sfaArr.length; i++) {
            let ARr = []
            for (let j = 0; j < sfaArr[i].length; j++) {
                if (bfa.includes(JSON.stringify(sfaArr[i][j]))) {
                    ARr.push(sfaArr[i][j])
                }
                // console.log(sfaArr[i][j],'asdfasdfasfasd')
            }
            SArr.push(ARr)
        }
        return SArr
    }
    /**
     * 数组aArr和bArr是否有交集(一维数组)
     * 
    */
    includeArr(aArr, bArr) {
        for (let i = 0; i < bArr.length; i++) {
            if(!(Array.isArray(aArr))){
                // console.log(aArr)
            }

            if (aArr.includes(bArr[i])) {
                return true
            }
        }
        return false
    }
    /**
     * 数组合并(一维)
    */
    mergeArr(aArr, bArr) {
        const res = Array.from(new Set(aArr.push(...bArr)))
        return res
    }
}