import React, { useState } from 'react';

import {
  EuiInlineEditText,
  EuiSpacer,
  EuiButtonGroup,
  EuiInlineEditTextProps,
} from '../../../../src';

export default () => {
  const textSizeButtons = [
    {
      id: 'xs',
      label: 'Extra Small',
    },
    {
      id: 's',
      label: 'Small',
    },
    {
      id: 'm',
      label: 'Medium',
    },
  ];

  const [toggleTextButtonSize, setToggleTextButtonSize] = useState<
    EuiInlineEditTextProps['size']
  >('m');

  const textSizeOnChange = (optionId: EuiInlineEditTextProps['size']) => {
    setToggleTextButtonSize(optionId);
  };

  const [testForOnSaveProp, setTestForOnSaveProp] = useState('');

  return (
    <>
      <EuiButtonGroup
        legend="Text size"
        options={textSizeButtons}
        idSelected={toggleTextButtonSize as string}
        onChange={(id) =>
          textSizeOnChange(id as EuiInlineEditTextProps['size'])
        }
      />

      <EuiSpacer />

      <EuiInlineEditText
        inputAriaLabel="Edit text inline"
        defaultValue="Hello World!"
        size={toggleTextButtonSize}
        onSave={(onSaveVal) => {
          setTestForOnSaveProp(onSaveVal);
        }}
      />

      <EuiSpacer />

      <p>Test for onSave Prop below:</p>
      <p>{testForOnSaveProp}</p>
    </>
  );
};
