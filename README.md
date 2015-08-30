# video-codec.js

JavaScriptによる各種映像符号のエンコード／デコードサンプルです．

Demo: https://kazuki.github.io/video-codec.js/index.html

以下のライブラリを[emscripten](http://emscripten.org)を使ってJavaScriptにコンパイルし，利用しています．
(括弧で囲まれているライブラリは将来サポート予定で現在はまだ対応していません)

* [daala](https://xiph.org/daala/): Daala Encoder/Decoder
* [openH264](http://www.openh264.org/): H.264 Encoder/Decoder
* [libvpx](http://www.webmproject.org/): VP8/VP9/VP10 Encoder/Decoder
* ([libde265](http://www.libde265.org/): H.265 Encoder/Decoder)
* ([thor](https://github.com/cisco/thor): [Thor](https://tools.ietf.org/html/draft-fuldseth-netvc-thor) Encoder/Decoder)

## コンパイル方法

emscriptenを準備し，emconfigureやemcc等のコマンドにPATHを通し，
以下のコマンドを実行します．

```
$ make
```

## API

エンコーダ／デコーダはWeb Workers上で動作します．Workerとの通信は次のようなプロトコルで行います．

### エンコーダ

#### 初期化

Workerに対して次のメッセージを送ることでエンコーダを初期化します．
初期化は一度しか実行できないほか，Workerに対して一番最初に送るメッセージである必要があります．

```
{
    width: number   /* (required) フレームの幅(px) */,
    height: number  /* (required) フレームの高さ(px) */,
    fps_num: number /* (required) フレームレート(分子) */,
    fps_den: number /* (required) フレームレート(分母) */,
}
```

#### エンコード

エンコード対象のフレーム(ArrayBuffer/ArrayBufferView)をpostMessageで送信することでエンコードします．
色空間はYUV420(I420)のみを受け付けます．

```
{
    timestamp: number,
    data: ArrayBuffer,
    y: Uint8ClampedArray,
    u: Uint8ClampedArray,
    v: Uint8ClampedArray,
    transferable: boolean,
}
```

#### エンコード完了処理

postMessageで次のメッセージを送信することにより，
エンコーダに全フレームの送信を終えたことを通知し，
すべての符号化されたデータを送出するように指示します．

```
{
    flush: true
}
```

#### エンコード済みデータ

WebWorkerでエンコードされたフレームは，onmessageイベントハンドラを経由して受け取ります．

```
{
    status: number /* (required) ステータスコード
                      0: フレームのエンコードに成功(バイナリデータ有り)
                      1: フレームのエンコードに成功(バイナリデータ無し)
                      それ以外: エラー */,
    error: string /* (optional) statusがエラーの時にエラーメッセージが格納される */,
    data: ArrayBuffer|ArrayBufferView /* (optional) status=0 の時にバイナリデータが格納される */,
}
```

### デコーダ

#### デコード

符号化された情報(ArrayBuffer|ArrayBufferView)をpostMessageを用いてデコーダに送信します．

#### デコード済みフレーム受信

WebWorkerのonmessageイベントハンドラ経由でデコードしたフレームを受信します．

```
{
    status: number /* (required) ステータスコード．0は成功．それ以外は失敗 */
    error: string  /* (optional) status != 0の時にエラーメッセージが入る */
    width: number   /* (optional) フレームの幅(px) */,
    height: number  /* (optional) フレームの高さ(px) */,
    data: ArrayBuffer|ArrayBufferView /* (optional) */,
}
```

ライセンス
----------

各種ライブラリのライセンスに準拠します．
