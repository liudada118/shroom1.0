import React from 'react'

export default function asideSetting() {
  return (
       <div style={{ position: 'relative' }}>
        <img onClick={() => {
          const show = this.state.show
          this.setState({
            open: true
          })
        }} className='optionImg' src={option} alt="" />
        <Drawer style={{ backgroundColor: 'rgba(21,18,42,0.8)' }} title={t('setData')} onClose={() => { this.setState({ open: false }) }} open={this.state.open}>
          <div className='slideContent' style={{ width: '300px', }}>
            <div
              className="flexcenter"
              style={{
                flex: 1,
                flexDirection: "column",
              }}
            >
              <div
                className="progerssSlide"
                style={{
                  display: "flex",

                  alignItems: "center",
                }}
              >
                <div
                  className='dataTitle'
                >
                  {t('guass')}
                </div>
                <Slider
                  min={0.1}
                  max={8}
                  onChange={(value) => {
                    localStorage.setItem("carValueg", value);

                    this.props.changeStateData({ valueg1: value })

                    changeLocalStroage({ sensorType: this.props.matrixName, valueType: 'valueg1', value })

                    if (this.props.com.current) {
                      if (this.props.com.current.sitValue) {
                        this.props.com.current.sitValue({
                          valueg: value,
                        });
                      }
                      if (this.props.com.current.backValue) {
                        this.props.com.current.backValue({
                          valueg: value,
                        });
                      }
                      // if(this.props.com.current.changeColor){
                      //   this.props.com.current.changeColor({size : value})
                      // }
                    }

                  }}
                  value={this.props.valueg1}
                  step={0.1}

                  style={{ width: '200px' }}
                />
              </div>


              <div
                className="progerssSlide"
                style={{
                  display: "flex",

                  alignItems: "center",
                }}
              >
                <div
                  className='dataTitle'
                >
                  size
                </div>
                <Slider
                  min={1}
                  max={50}
                  onChange={(value) => {
                    // localStorage.setItem("carValueg", value);

                    // this.props.changeStateData({ valueg1: value })

                    // changeLocalStroage({ sensorType: this.props.matrixName, valueType: 'valueg1', value })

                    if (this.props.com.current) {
                      // if (this.props.com.current.sitValue) {
                      //   this.props.com.current.sitValue({
                      //     valueg: value,
                      //   });
                      // }
                      // if (this.props.com.current.backValue) {
                      //   this.props.com.current.backValue({
                      //     valueg: value,
                      //   });
                      // }
                      if (this.props.com.current.changeColor) {
                        this.props.com.current.changeColor({ size: value })
                      }
                    }

                  }}
                  // value={this.props.valueg1}
                  step={0.1}

                  style={{ width: '200px' }}
                />
              </div>

              <div
                className="progerssSlide"
                style={{
                  display: "flex",
                  alignItems: "center",
                  //   padding : '5px',
                  //   borderRadius : 10,
                  //   backgroundColor : '#72aec9'
                }}
              >
                <div
                  className='dataTitle'
                >
                  {t('color')}
                </div>
                <Slider
                  min={5}
                  max={20000}
                  onChange={(value) => {
                    localStorage.setItem("carValuej", value);
                    // this.props.setValuej1(value);
                    this.props.changeStateData({ valuej1: value })

                    changeLocalStroage({ sensorType: this.props.matrixName, valueType: 'valuej1', value })

                    if (this.props.com.current) {
                      if (this.props.com.current.sitValue) {
                        this.props.com.current.sitValue({
                          valuej: value,
                        });
                      }
                      if (this.props.com.current.backValue) {
                        this.props.com.current.backValue({
                          valuej: value,
                        });
                      }
                      if (this.props.com.current.changeColor) {
                        this.props.com.current.changeColor({ max: value })
                      }

                    }


                  }}
                  value={this.props.valuej1}
                  step={10}
                  // value={this.props.}
                  style={{ width: '200px' }}
                />
              </div>
              <div
                className="progerssSlide"
                style={{
                  display: "flex",

                  alignItems: "center",
                }}
              >
                <div
                  className='dataTitle'
                >
                  {t('filter')}
                </div>
                <Slider
                  min={0}
                  max={100}
                  onChange={(value) => {
                    localStorage.setItem("carValuef", value);
                    // this.props.setValuef1(value);
                    this.props.changeStateData({ valuef1: value })
                    changeLocalStroage({ sensorType: this.props.matrixName, valueType: 'valuef1', value })

                    if (this.props.com.current) {
                      if (this.props.com.current.sitValue) {
                        this.props.com.current.sitValue({
                          valuef: value,
                        });
                      }
                      if (this.props.com.current.backValue) {
                        this.props.com.current.backValue({
                          valuef: value,
                        });
                      }

                      if (this.props.com.current.backValue) {
                        this.props.com.current.changeColor({
                          filter: value,
                        });
                      }
                    }


                  }}
                  value={this.props.valuef1}
                  step={2}
                  // value={this.props.}
                  style={{ width: '200px' }}
                />
              </div>

              <div
                className="progerssSlide"
                style={{
                  display: "flex",

                  alignItems: "center",
                }}
              >
                <div

                  className='dataTitle'
                >
                  {t('height')}
                </div>
                <Slider
                  min={0.1}
                  max={15}
                  onChange={(value) => {
                    localStorage.setItem("carValue", value);
                    // this.props.setValue1(value);
                    this.props.changeStateData({ value1: value })
                    changeLocalStroage({ sensorType: this.props.matrixName, valueType: 'value1', value })


                    if (this.props.com.current) {
                      if (this.props.com.current.sitValue) {
                        this.props.com.current.sitValue({
                          value: value,
                        });
                      }
                      if (this.props.com.current.backValue) {
                        this.props.com.current.backValue({
                          value: value,
                        });
                      }
                    }


                  }}
                  value={this.props.value1}
                  step={0.02}
                  // value={this.props.}
                  style={{ width: '200px' }}
                />
              </div>
              <div
                className="progerssSlide"
                style={{
                  display: "flex",

                  alignItems: "center",
                }}
              >
                <div

                  className='dataTitle'
                >
                  {t('consis')}
                </div>
                <Slider
                  min={1}
                  max={20}
                  onChange={(value) => {
                    localStorage.setItem("carValuel", value);
                    // this.props.setValuel1(value);
                    this.props.changeStateData({ valuel1: value })
                    changeLocalStroage({ sensorType: this.props.matrixName, valueType: 'valuel1', value })

                    if (this.props.com.current) {
                      if (this.props.com.current.sitValue) {
                        this.props.com.current.sitValue({
                          valuel: value,
                        });
                      }
                      if (this.props.com.current.backValue) {
                        this.props.com.current.backValue({
                          valuel: value,
                        });
                      }
                    }



                  }}
                  value={this.props.valuel1}
                  step={1}
                  // value={this.props.}
                  style={{ width: '200px' }}
                />
              </div>

              <div
                className="progerssSlide"
                style={{
                  display: "flex",

                  alignItems: "center",
                }}
              >
                <div
                  className='dataTitle'
                >
                  {t('init')}
                </div>
                <Slider
                  min={1}
                  max={5000}
                  onChange={(value) => {
                    localStorage.setItem("carValueInit", value);
                    // this.props.setValuelInit1(value);
                    this.props.changeStateData({ valuelInit1: value })

                    changeLocalStroage({ sensorType: this.props.matrixName, valueType: 'valuelInit1', value })

                    if (this.props.com.current) {
                      if (this.props.com.current.sitValsue) {
                        this.props.com.current.sitValue({
                          valuelInit: value,
                        });
                      }
                      if (this.props.com.current.backValue) {
                        this.props.com.current.backValue({
                          valuelInit: value,
                        });
                      }
                    }
                  }}
                  value={this.props.valuelInit1}
                  step={500}
                  style={{ width: '200px' }}
                />
              </div>

              <div
                className="progerssSlide"
                style={{
                  display: "flex",

                  alignItems: "center",
                }}
              >
                <div
                  className='dataTitle'
                >
                  {'light'}
                </div>
                <Slider
                  min={0}
                  max={1}
                  onChange={(value) => {

                    if (this.props.com.current) {
                      if (this.props.com.current.changeColor) {
                        this.props.com.current.changeColor({
                          light: value,
                        });
                      }
                    }
                  }}
                  // value={this.props.valuelInit1}
                  step={0.001}
                  style={{ width: '200px' }}
                />
              </div>

              <div
                className="progerssSlide"
                style={{
                  display: "flex",

                  alignItems: "center",
                }}
              >
                <div
                  className='dataTitle'
                >
                  {'speed'}
                </div>
                <Slider
                  min={1}
                  max={20}
                  onChange={(value) => {

                    if (this.props.com.current) {
                      if (this.props.com.current.changeColor) {
                        this.props.com.current.changeColor({
                          speedValue: value,
                        });
                      }
                    }
                  }}
                  // value={this.props.valuelInit1}
                  step={1}
                  style={{ width: '200px' }}
                />
              </div>

              <div
                className="progerssSlide"
                style={{
                  display: "flex",

                  alignItems: "center",
                }}
              >
                <div
                  className='dataTitle'
                >
                  {'x'}
                </div>
                <Slider
                  min={-20}
                  max={20}
                  onChange={(value) => {

                    if (this.props.com.current) {
                      if (this.props.com.current.changaCamera) {
                        this.props.com.current.changaCamera({
                          x: value,
                        });
                      }
                    }
                  }}
                  // value={this.props.valuelInit1}
                  step={0.01}
                  style={{ width: '200px' }}
                />
              </div>

              <div
                className="progerssSlide"
                style={{
                  display: "flex",

                  alignItems: "center",
                }}
              >
                <div
                  className='dataTitle'
                >
                  {'y'}
                </div>
                <Slider
                  min={-20}
                  max={20}
                  onChange={(value) => {

                    if (this.props.com.current) {
                      if (this.props.com.current.changaCamera) {
                        this.props.com.current.changaCamera({
                          y: value,
                        });
                      }
                    }
                  }}
                  // value={this.props.valuelInit1}
                  step={0.01}
                  style={{ width: '200px' }}
                />
              </div>

              <div
                className="progerssSlide"
                style={{
                  display: "flex",

                  alignItems: "center",
                }}
              >
                <div
                  className='dataTitle'
                >
                  {'z'}
                </div>
                <Slider
                  min={-20}
                  max={20}
                  onChange={(value) => {

                    if (this.props.com.current) {
                      if (this.props.com.current.changaCamera) {
                        this.props.com.current.changaCamera({
                          z: value,
                        });
                      }
                    }
                  }}
                  // value={this.props.valuelInit1}
                  step={0.01}
                  style={{ width: '200px' }}
                />
              </div>

              {/* 分压 */}
              {/* <div
                className="progerssSlide"
                style={{
                  display: "flex",

                  alignItems: "center",
                }}
              >
                <div
                  className='dataTitle'
                >
                  {t('init')}
                </div>
                <Slider
                  min={1}
                  max={6000}
                  onChange={(value) => {
                    this.props.wsSendObj({ up: value })
                  }}
                  // value={this.props.valuelInit1}
                  step={1}
                  style={{ width: '200px' }}
                />
              </div>

              <div
                className="progerssSlide"
                style={{
                  display: "flex",

                  alignItems: "center",
                }}
              >
                <div
                  className='dataTitle'
                >
                  {t('init')}
                </div>
                <Slider
                  min={0.1}
                  max={20}
                  onChange={(value) => {
                    this.props.wsSendObj({ down: value })
                  }}
                  // value={this.props.valuelInit1}
                  step={0.1}
                  style={{ width: '200px' }}
                />
              </div> */}

            </div>
          </div>
          <>
            <Select
              style={{ width: 300 }}
              placeholder={t('feaLabel')}
              onChange={this.onChange}
              dropdownRender={(menu) => (
                <>
                  {menu}
                  <Divider style={{ margin: '8px 0' }} />
                  <Space style={{ padding: '0 8px 4px' }}>
                    <Input
                      placeholder="Please enter item"
                      ref={this.inputRef}
                      value={this.state.name}
                      onChange={this.onNameChange}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    <Button type="text" icon={<PlusOutlined />} onClick={this.addItem}>
                      {t('add')}
                    </Button>
                    <Button type="text" onClick={() => {
                      this.setState({ items: [] })
                      localStorage.removeItem('sitType')
                    }}>
                      {t('delete')}
                    </Button>
                  </Space>
                </>
              )}
              options={this.state.items.map((item) => ({ label: item, value: item }))}
            />
            <Select
              style={{ width: 300 }}
              placeholder={t('feaLabel')}
              onChange={this.onChange1}
              dropdownRender={(menu) => (
                <>
                  {menu}
                  <Divider style={{ margin: '8px 0' }} />
                  <Space style={{ padding: '0 8px 4px' }}>
                    <Input
                      placeholder="Please enter item"
                      ref={this.inputRef1}
                      value={this.state.name1}
                      onChange={this.onNameChange1}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    <Button type="text" icon={<PlusOutlined />} onClick={this.addItem1}>
                      {t('add')}
                    </Button>
                    <Button type="text" onClick={() => {
                      this.setState({ items1: [] })
                      localStorage.removeItem('sitType1')
                    }}>
                      {t('delete')}
                    </Button>
                  </Space>
                </>
              )}
              options={this.state.items1.map((item) => ({ label: item, value: item }))}
            />
            {this.props.matrixName == 'Num3D' || this.props.matrixName == 'volvo' || this.props.matrixName == 'gloves1' || this.props.matrixName == 'gloves2' || this.props.matrixName == 'hand0205Point' || this.props.matrixName == 'handVideo' || this.props.matrixName == 'robot1' || this.props.matrixName.includes('hand') ? <> <Button onClick={() => {
              // this.props.dataZero()
              // this.setState({
              //   resetZero: true
              // })
              this.props.changeAside({
                resetZero: true
              })
              this.props.wsSendObj({ resetZero: true })

            }}>{t('resetZero')}</Button>
              <Button onClick={() => {
                //  this.setState({
                //   resetZero: false
                // })
                this.props.changeAside({
                  resetZero: false
                })
                // this.props.dataZero0()
                this.props.wsSendObj({ resetZero: false })
              }}>{t('cancelZero')}</Button></> : ''}

            <NavLink to={`/num/${routerStr}`}> <Button onClick={() => {
              this.props.dataZero0()
            }}>{t('rawData')}</Button></NavLink>

            <NavLink to={`/?a=b`}> <Button onClick={() => {
              // this.props.dataZero0()
            }}>{t('key')}</Button></NavLink>
          </>
        </Drawer>
      </div>
  )
}
