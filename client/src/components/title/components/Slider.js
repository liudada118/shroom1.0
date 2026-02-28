import React from 'react'

export default function Slider() {
    return (
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
                    }
                }}
                value={this.props.valueg1}
                step={0.1}

                style={{ width: '200px' }}
            />
        </div>
    )
}
