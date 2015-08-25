# video-codec.js

JavaScriptによる各種映像符号のエンコード／デコードサンプルです．

以下のライブラリを[emscripten](http://emscripten.org)を使ってJavaScriptにコンパイルし，利用しています．

* [openH264](http://www.openh264.org/): H.264 Encoder/Decoder
* [libde265](http://www.libde265.org/): H.265 Encoder/Decoder
* [libvpx](http://www.webmproject.org/): VP8/VP9/VP10 Encoder/Decoder
* [thor](https://github.com/cisco/thor): [Thor](https://tools.ietf.org/html/draft-fuldseth-netvc-thor) Encoder/Decoder


## コンパイル方法

emscriptenを準備し，emconfigureやemcc等のコマンドにPATHを通し，
以下のコマンドを実行します．

```
$ ./apply-patch.sh
$ make
```

## API

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
    }

* **width**: フレームの幅(px)
* **height**: フレームの高さ(px)
* **fps_num**: フレームレート(分子)
* **fps_den**: フレームレート(分母)

#### エンコード

エンコード対象のフレーム(ArrayBuffer/ArrayBufferView)をpostMessageで送信することでエンコードします．

フレームを受け取ったエンコーダはエンコード処理を実施後，結果をArrayBufferで返却します．
結果のバイト数が1バイトよりも大きい場合は，符号化されたデータが格納されています．
結果のバイト数が1バイトの場合は値によって次の意味を持ちます．

* *0*: エンコード成功
* *1*: フラッシュ処理が完了しすべての符号化されたデータを送信し終えた
* *255*: エラー

#### エンコード完了処理

postMessageで0バイトのArrayBufferを送信することにより，
エンコーダに全フレームの送信を終えたことを通知し，すべての符号化されたデータを送出するように指示します．
エンコーダからの戻り値は，エンコードと同じです．

### デコーダ

#### デコード

符号化された情報(UintArray8)をpostMessageを用いてデコーダに送信します．

符号化された情報を受け取ったデコーダはデコード処理を実施後，結果をArrayBufferで返却します．
一番最初のフレームのデコード時は，次の情報(Object型)を返却します．

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

各種ライブラリのライセンスに準拠します．
