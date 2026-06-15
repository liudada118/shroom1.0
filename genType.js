const module2 = require('./aes_ecb')
let str = module2.encStr(`45`);

let str1 = module2.decryptStr(str)
let str2 = module2.decryptStr('83ade528084c5547836f55dbcfa68742')
const readline = require('readline');

let str3 = module2.decryptStr('4f04ca381d5ff7b74704280a6cc568f0f07e25d08c6d1dacc284182a440405214a6aa8032b94252ee415f56d8a8ab72d')
console.log(str , str1 , str2 , str3)
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// ask user for the anme input
rl.question(`请输入一个传感器类型`, (day) => {

    // ask for nationality
   
        // const date = new Date().getTime() + day*24*60*60*1000
        // log user details
        console.log(`${day}的密钥是${module2.encStr(`${day}`)}`);



});
// let str = module2.encStr(`45`);

// let str1 = module2.decryptStr(str)
// let str2 = module2.decryptStr('83ade528084c5547836f55dbcfa68742')

// let str3 = module2.decryptStr('325699aacaf28e5743c313673d3e2c066f28abf9846a45a456735f8ecab8e5439405205fc2199e4e1374ceeb904b059659ce62fd6f047a5460f665a7d07f32270a32a94dc7c8ddc3790ef5fea6b95fd5')
// console.log(str , str1 , str2 , str3)
