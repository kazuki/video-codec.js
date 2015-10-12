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

エンコーダ／デコーダはWeb Workers上で動作します．
通常は api.ts で定義している IEncoder/IDecoder インタフェースを実装した，
Encoder/Decoderクラスを利用します (utils.tsで定義)．

エンコーダ／デコーダの各メソッドは全てPromiseを返却します．

以下，全てのサンプルはTypeScriptを例に上げますが，
もちろんJavaScriptからも利用できます．

### エンコーダ

#### コンストラクタ

利用したい映像符号のエンコーダのJavaScriptファイルを指定します．

```
// VPxエンコーダを利用する場合
var encoder: IEncoder = new Encoder('vpx_encoder.js');

// Daalaエンコーダを利用する場合
var encoder: IEncoder = new Encoder('daala_encoder.js');

// openH264のエンコーダを利用する場合
var encoder: IEncoder = new Encoder('openh264_encoder.js');
```

#### 初期化

エンコーダは初期化関数を一番最初に1度だけ呼び出す必要があります．
api.ts で定義している EncoderConfig インタフェースに基づく設定情報を渡します．

setupではコーデックによってはヘッダ情報等を含むパケットを返却します．
packet.dataがnullの場合は，ヘッダ情報等は特に必要のないコーデックです．

```
encoder.setup({
    width: 320,
    height: 160,
    fps_num: 10,
    fps_den: 1,
    params: { /* コーデック固有のエンコードパラメータ */ }
}).then((packet: Packet) => {
    console.log('Setup成功', packet);
}, (e) => {
    console.log('Setup失敗', e);
});
```

#### エンコード

YUV420(I420)形式のフレームをエンコードします．
RGB等は受け付けないので，必ずYUV420(I420)に変換してから，api.tsで定義しているVideoFrameの形式で渡します．

なお，VideoFrameのtransferableがtrueの場合は，Workerにメモリをムーブするので，
呼び出し元では利用できなくなることを表します．

エンコードが成功するとPacketが返却されますが，
コーデックによってはフレームのエンコードが成功した場合でもバイナリを出力せずに遅延させる場合が有ります．
その場合は，Packetのdataがnullになります．

```
encoder.encode({
    timestamp: 0 /* フレームのタイムスタンプ */,
    data: buf /* y,u,vのベースとなっているArrayBuffer*/,
    y: /* Y成分 (Uint8ClampedArray) */,
    u: /* U成分 (Uint8ClampedArray) */,
    v: /* V成分 (Uint8ClampedArray) */,
    transferable: true /* dataがWorkerに転送可能かどうか示す */,
}).then((packet) => {
    console.log('エンコード成功:', packet);
}, (e) => {
    console.log('エンコード失敗:', e);
});
```

### デコーダ

#### コンストラクタ

エンコーダと同様に，利用したい映像符号のデコーダに対応するJavaScriptを指定します．

```
// VPx
var decoder: IDecoder = new Decoder('vpx_decoder.js');

// Daala
var decoder: IDecoder = new Decoder('daala_decoder.js');

// openH264
var decoder: IDecoder = new Decoder('openh264_decoder.js');
```

#### 初期化

デコーダもエンコーダと同様に，一番最初に1度だけ初期化関数を呼び出す必要が有ります．
第一引数にはデコーダに渡すパラメータを指定し，
第二引数にはエンコーダのsetupで戻ってきたパケット情報を指定します．

```
decoder.setup({}, packet).then(() => {
    console.log('デコーダ初期化成功');
}, (e) => {
    console.log('デコーダの初期化に失敗: ', e);
});
```

#### デコード

エンコーダのencode関数の戻り値であるパケットをデコードします．
パケットをデコードした結果，フレームが返却されないことも有り，その場合はVideoFrameのdataがnullになります．

```
decoder.decode(packet).then((frame: VideoFrame) => {
    if (frame.data) {
        console.log('デコード成功: フレーム有り');
    } else {
        console.log('デコード成功: フレーム無し');
    }
}, (e) => {
    console.log('デコード失敗: ', e);
});
```

ライセンス
----------

各種ライブラリは各種ライブラリのライセンスに準拠します．
それ以外の部分は修正BSDライセンスになります．
