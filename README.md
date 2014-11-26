video-codec.js
==============

JavaScriptによるH.264エンコーダ/デコーダのサンプルです．
エンコーダはx264，デコーダはopenH264をemscriptenを使ってコンパイルし，利用しています．


コンパイル方法
--------------

emscriptenを準備し，emconfigureやemcc等のコマンドにPATHを通し，
以下のコマンドを実行します．

    $ ./build-dep-libs
    $ make


サンプルの内容
--------------

**index.html**: ローカルファイルのエンコード・デコードサンプル．y4mファイルやH.264のByte stream format(Annex B)を再生したり，y4mファイルからH.264へエンコードを行います

**camera.html**: WebRTCを使って取得したカメラの映像をWebWorkerでエンコード・デコードしレンダリングするサンプル

renderer.tsに含まれるシェーダによる色空間変換コードは[Broadway]のものを利用しています．


API
---

エンコーダ／デコーダはWeb Workers上で動作します．Workerとの通信は次のようなプロトコルで行います．

### エンコーダ

#### 初期化

Workerに対して次のメッセージを送ることでエンコーダを初期化します．
初期化は一度しか行えませんし，Workerに対して一番最初に送るメッセージである必要があります．

    {
        width: <number|required>,
        height: <number|required>,
        fps_num: <number|required>,
        fps_den: <number|required>,
        rgb: <boolean|optional>
    }

* **width**: フレームの幅(px)
* **height**: フレームの高さ(px)
* **fps_num**: フレームレート(分子)
* **fps_den**: フレームレート(分母)
* **rgb**: フレームの色空間の種類．trueでRGB(各8bit)，falseの場合YUV420

#### エンコード

エンコード対象のフレーム(UintArray8)をpostMessageで送信することでエンコードします．

フレームを受け取ったエンコーダはエンコード処理を実施後，結果をUint8Array型で返却します．
lengthが1バイトよりも大きい場合は，符号化されたデータが格納されています．
lengthが1バイトの場合は値によって次の意味を持ちます．

* *0*: エンコード成功
* *1*: フラッシュ処理が完了しすべての符号化されたデータを送信し終えた
* *255*: エラー

#### エンコード完了処理

エンコーダに全フレームの送信を終えたことを通知し，すべての符号化されたデータを送出するように指示します．
エンコーダからの戻り値は，エンコードと同じです．

### デコーダ

#### デコード

符号化された情報(UintArray8)をpostMessageを用いてデコーダに送信します．

符号化された情報を受け取ったデコーダはデコード処理を実施後，結果をUint8Array型で返却します．
一番最初のフレームのデコード時は，次の情報を返却します．

    {
        width: <number>,
        height: <number>
    }

lengthが1バイトよりも大きい場合は，YUV420形式のフレームが入っています．
lengthが1バイトの場合は値によって次の意味を持ちます．

* *0*: エンコード成功
* *1*: フラッシュ処理が完了しすべての符号化されたデータを送信し終えた
* *255*: エラー

ライセンス
----------

libx264.jsはx264のライセンスに依存するのでGPLv2です．
libopenh264.jsはopenH264のライセンスに依存するので二条項BSDライセンスです．
その他の部分はGPLv2ライセンスになります．

[Broadway]: https://github.com/mbebenita/Broadway "Broadway: A JavaScript H.264 decoder."
