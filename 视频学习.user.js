// ==UserScript==
// @name        视频学习
// @namespace    http://tampermonkey.net/
// @homepageURL https://pooorfoool.gitee.io/study
// @version      1.1.2
// @description   适用于：灯塔-干部网络学院
// @author       郭
// @match        https://gbwlxy.dtdjzx.gov.cn/content*
// @match        https://gbwlxy.dtdjzx.gov.cn//content*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
/*---------------------------------------------------------
版本:   V1.1.2
描述:   灯塔干部网络学院学习&答题
问题：   1.需设置浏览器 【允许弹窗】
        2.推荐 firefox 或 chrome 浏览器
        如不要答题，Env.autoExam 设置为false
记录:   
2023-06-06 修改答题payload,都正确却考试未通过bug
2023-06-06 增加视频结束到页面结束的时间，解决部分视频未能完全结束bug
2023-06-05 修复无答题的页面学完不关闭的bug
2023-06-01 调试中
----------------------------------------------------------*/
/***********************  公共  ***************************/
/*---------------------------------------------------------
名称:   Env
描述:   环境变量
实现:   通过vue实例 获取数据 ,在调度中update
记录:   2023-06-01 完成编写
----------------------------------------------------------*/
const Env = {
    app: document.querySelector('section>div')?.__vue__,
    timeTable: undefined,
    handl: null,
    autoExam:true,
    get name() {
        //页面名称,用于识别所在页面,在网址中有出现
        return this.app?.$route?.name;
    },
    get courseCount() {
        //课表的总课数
        return this.fit({
            'projectDetail': this.app?.resources?.totalNum,
            'specialReDetails': this.app?.detail?.courseCount
        })
    },
    get courseListId() {
        //课表id
        return this.app?.$route?.query?.id || this.app?.$route?.query?.courseListId;
    },
    get courseId() {
        //课程id
        return this.fit({
            'projectDetailxx': this.app?.$route?.query?.courseId,
            'specialReDetailsxx': this.app?.$route?.query?.courseId,
            'projectDetailxx': this.app?.resources?.id,
            'specialReDetailsxx': this.app?.detail?.id,
        })
    },
    get examId() {
        //试题id
        return this.fit({
            'coursedetail': this.app?.tabDetail?.assessementId
        })
    },
    get ifExam() {
        //0有考试，1无考试
        var v = this.fit({
            'coursedetail': this.app?.tabDetail?.assessementType
        });
        return v == "0";
    },
    get idCardHash() {
        //用户idcardhash
        return this.app?.userInfo?.idCardHash;
    },
    get payload() {
        //课表payload
        return JSON.stringify({
            idCardHash: this.idCardHash,
            pagenum: 0,
            pagesize: this.courseCount,
            subjectId: this.courseListId,
            tbtpId: this.courseListId
        });
    },
    get courseListApi() {
        //课表api地址,从服务器读课表用
        return this.fit({
            'projectDetail': location.origin + '/__api/api/portal/course/getPageByCategory',
            'specialReDetails': location.origin + '/__api/api/subject/queryCourse'
        })
    },
    coursedetailURL(courseId, courseListId) {
        //打开该网址可以学习此课
        let url = 'https://gbwlxy.dtdjzx.gov.cn/content#/commend/coursedetail?';
        url += `courseId=${courseId}&courseListId=${courseListId}`;
        return this.fit({
            'projectDetail': url += '&flag=bj',
            'specialReDetails': url += '&flag=zt'
        })
    },
    fit(obj) {
        //根据不用的业务返回值
        var result = obj[this.name];
        this.validate(result);
        return result;
    },
    validate(result) {
        //在验证值为undefined的时候警告,调试用
        if (result == undefined) console.warn("读取值失败,可能本页无该值,页面--", this.name);
    },
    update() {
        //更新vue实例
        this.app = document.querySelector('section>div')?.__vue__;
        this.timeTable = undefined;
        clearInterval(this?.timerId);
    }
}
/*---------------------------------------------------------
函数名: showMsg
描述:   在右侧栏展示信息，最多5条
记录:   
----------------------------------------------------------*/
function showMsg(msg, type = 'msg') {
    if (window.monkeydata == undefined) {
        console.error('alpinejs存在错误');
        return;
    }
    if (type == 'msg') {
        window.monkeydata.message = msg;
    } else {
        window.monkeydata.tip = msg;
    }

}
/*---------------------------------------------------------
函数名: queryList
描述:   从服务器获取 课表 和 答案
输入：  url :api地址
        payload：JSON数据
记录:   
----------------------------------------------------------*/
function queryList(url, payload) {
    return fetch(url, {
        "body": payload,
        "method": "POST"
    }).then(res => res.json());
}
/***********************  初始化 *****************************/
/*---------------------------------------------------------
函数名: initEnv
描述:   入口:初始化环境
        1.关联【策略】与【路径】
            ** vue改变hash打开新页面,不会重新加载脚本,需监听
        2.改造显示面板
            ** 右侧浮动栏变成显示面板
            ** 使用了Alpinejs
        3.Alpinejs 加载完后执行 策略
记录:   
----------------------------------------------------------*/
(function initEnv() {
    let panelNode = document.querySelector('.right-fixed-wrap');
    console.log('脚本......准备');
    if (!panelNode) {
        console.log('页面还未准备好...1s后再试');
        setTimeout(initEnv, 1000);
        return;
    }
    console.log('脚本......开始');
    //监听页面变化
    panelNode.__vue__.$router.afterHooks.push(routerHook);
    console.log('路径钩子......ok');
    //改造面板
    panelNode.style.cssText += "width:250px";
    panelNode.querySelector('ul').outerHTML = `
        <ul x-data="{message:'',tip:''}" x-init="window.monkeydata=$data">
        <li x-text="message" style="font-size:14px"></li>
        <li x-text="tip" style="font-size:18px"></li>
        </ul>`;
    //注入Alpinejs
    let scriptNode = document.createElement('script');
    scriptNode.src = "https://unpkg.com/alpinejs@3.10.3/dist/cdn.min.js";
    scriptNode.defer = true;
    document.head.appendChild(scriptNode);
    console.log('信息面板......准备');
    document.addEventListener('alpine:initialized', function () {
        console.log('信息面板......ok');
        showMsg('脚本.....ok');
        routerHook();
    });
})();
/***********************  调度  *****************************/
/*---------------------------------------------------------
函数名: strategies
描述:   策略,根据所处页面做出动作，与路径hash相关   
记录:   
----------------------------------------------------------*/
function strategies() {
    Env.update();
    switch (Env.name) {
        case 'projectDetail':
        //专题班目录
        case 'specialReDetails':
            //专栏目录
            timeTableHook();
            getCourseList().then(makeTable);
            break;
        case 'coursedetail':
            //课程页
            xq();
            break;
        default:
            console.log('请进入专栏目录或专题班目录');
            showMsg('请进入专栏目录或专题班目录');
    }
}
/*---------------------------------------------------------
函数名: routerHook
描述:   路径变化时调用策略
        需延时等待页面加载完成    
记录:   
----------------------------------------------------------*/
function routerHook() {
    setTimeout(strategies, 5000);
}
/*---------------------------------------------------------
函数名: timeTableHook
描述:   课表准备好 且 无打开的课程 打开下一课
记录:   
----------------------------------------------------------*/
function timeTableHook() {
    Env.timerId = setInterval(() => {
        if (!Env.timeTable) return; //无有效课表
        if (Env.handl?.closed == false) return; //正在播放
        var c = Env.timeTable.next();
        if (c.done) return; //全学完
        Env.handl = window.open(c.value);
    }, 2000);
}
/***********************  课程  *****************************/
/*---------------------------------------------------------
函数名: getCourseList
描述:   获取全部课程
记录:   
----------------------------------------------------------*/
function getCourseList() {
    console.log('获取课程......');
    showMsg('获取课表......')
    //读取全部课程
    return queryList(Env.courseListApi, Env.payload);
}
/*---------------------------------------------------------
函数名: makeTable
描述:   制作课表,挂到window，以便学习
        Env.timeTable.next()是学习下一课   
记录:   6-2重写
----------------------------------------------------------*/
function makeTable(res) {
    console.log('课表.......ok');
    showMsg('课表......ok');
    Env.timeTable = {
        courseList: res.datalist,
        courseListId: Env.courseListId,
        index: 0,
        next() {
            var done = this.index >= this.courseList.length;
            showMsg(`第__${this.index+1}__课...共__${this.courseList.length}__课`,'info');
            if (done) {
                console.warn('没有下一课了');
                return { done: true, value: undefined };
            }
            var course = this.courseList[this.index++];
            console.log('准备......', course.name);
            showMsg(course.name);
            //跳过已学习
            if (course.showStatusMsg == '已学习') { return this.next(); }
            else return { done: false, value: Env.coursedetailURL(course.id, this.courseListId) };
        }
    }
}
/***********************  考试  *****************************/
/*---------------------------------------------------------
函数名: getExam
描述:   获取试题
记录:   
----------------------------------------------------------*/
function getExam() {
    console.log('读题......');
    const url = "https://gbwlxy.dtdjzx.gov.cn/__api/api/myExam/web/getExam";
    const payload = JSON.stringify({ examId: Env.examId, idCardHash: Env.idCardHash });
    return queryList(url, payload);
}
/*---------------------------------------------------------
函数名: fillAnswers
描述:   填写答案
输入:   dataList 试题
        answerList 答案,没有答案的时候都填A
记录:   
----------------------------------------------------------*/
function fillAnswers(exam) {
    console.log('答卷......');
    var questionList = exam.data.dataList;
    var answerList = window.examAnswers || [];
    return questionList.map((item, index) => {
        return {
            "examId": Env.examId,
            "questionId": item.questionId,
            "answer": answerList[index] || '["A"]'
        }
    })
}
/*---------------------------------------------------------
函数名: submitExam
描述:   提交试题
记录:   
----------------------------------------------------------*/
function submitExam(recordList) {
    console.log('交卷......');
    const url = "https://gbwlxy.dtdjzx.gov.cn/__api/api/myExam/web/v2/submitExam";
    let detail = Env.app.tabDetail;
    let info = Env.app.userInfo
    const payload = JSON.stringify({
        courseId: detail.id,
        examId: detail.assessementId,
        examStatus: "0",
        hash: info.idCardHash,
        orgCode: "",
        orgId: "",
        peopleRecordList: recordList,
        recordStatus: "1",
        sourceClient: "pc",
        studyStatus: "1",
        tbtpId: "",
        telephone: info.telephone,
        username: info.name
    });
    return queryList(url, payload);
}
/*---------------------------------------------------------
函数名: pickAnswers
描述:   submitExam后返回值带答案，找出答案
        答案挂在window.examAnswers ,fillAnswers用到
记录:   
----------------------------------------------------------*/
function pickAnswers(exam) {
    console.log('找答案......');
    let dataList = exam.data.examAnswerRecordList;
    window.examAnswers = dataList.map(t => t.answer);
    return window.examAnswers;
}
/*---------------------------------------------------------
函数名: completeExam
描述:   完成答题全流程
        读题-->试答-->找答案-->再读题-->再答-->验证
记录:   
----------------------------------------------------------*/
function completeExam() {
    console.log('尝试考试');
    if (!Env.ifExam) {
        console.log('这一课没有考试');
        showMsg('这一课没有考试')
        return Promise.resolve();
    }
    if (!Env.autoExam) {
        console.log('用户放弃考试');
        showMsg('用户放弃考试')
        return Promise.resolve();
    }
    var work = getExam()
        .then(fillAnswers)
        .then(submitExam)
        .then(pickAnswers)
        .then(getExam)
        .then(fillAnswers)
        .then(submitExam)
        .then(res => {
            if (res.data && res.data.wrongCount == 0) {
                console.log('考试.......完成');

                showMsg('考试.......完成');
            } else {
                console.warn('考试.......未能通过....检查代码');
                showMsg('考试.......失败');
            }
        });
    return work;
}
/*---------------------------------------------------------
函数名: examHook
描述:   钩子
        替换原答题,视频播放完毕后答题
记录:   
----------------------------------------------------------*/
function examHook() {
    console.log('添加exam钩子');
    window.monkeydata.exam = completeExam;
    //删除原答题
    Env.app.tomyExam = function () { };
    document.querySelector('video').addEventListener('ended',function(){
        //视频结束原网站会做收尾工作，延时以免影响
        setTimeout(() => {
            completeExam().then(window.close) 
        }, 15000);
    })
    
}
/***********************  播放  *****************************/

/*---------------------------------------------------------
函数名: xq
描述:   单课学习
记录:   2023-05-30 完成编写
----------------------------------------------------------*/
function xq() {
    console.log('学习中...');
    showMsg('准备学习......');
    //自动播放
    var video = document.querySelector('video');
    //确保成功
    if (!video) {
        setTimeout(xq, 2000);
        return;
    }
    video.muted = true;//自动播放需静音
    video.play();
    showMsg('学习中......');
    examHook();
}


})();